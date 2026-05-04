<#
.SYNOPSIS
  Pushes design tokens to Figma Variables via the REST API.
  Creates two Variable collections in your Figma file:
    Primitives (Default mode)  - raw color scales + foundations
    Semantic   (Light / Dark)  - semantic aliases pointing to Primitives

.USAGE
  powershell -ExecutionPolicy Bypass -File scripts/push-to-figma.ps1
#>

$ErrorActionPreference = 'Stop'

# --- CREDENTIALS ---
# Set FIGMA_TOKEN and FIGMA_FILE_KEY in your .env or system environment before running.
$FigmaToken = $env:FIGMA_TOKEN
$FileKey    = if ($env:FIGMA_FILE_KEY) { $env:FIGMA_FILE_KEY } else { 'Bx2SZ05iUtuDw4xWoDMjJs' }

if (-not $FigmaToken) { $FigmaToken = Read-Host "Personal Access Token" }
if (-not $FileKey)    { $FileKey    = Read-Host "File Key" }

$TokensFile = Join-Path $PSScriptRoot '..\tokens\tokens.json'

if (-not (Test-Path $TokensFile)) {
    Write-Error "tokens.json not found at $TokensFile - run convert-tokens.ps1 first."
    exit 1
}

$raw   = Get-Content $TokensFile -Raw | ConvertFrom-Json
$prims = $raw.primitives
$light = $raw.'semantic/light'
$dark  = $raw.'semantic/dark'

# --- FLATTEN: nested token object -> flat list of Path, Value, Type ---

function Flatten-Tokens($obj, [string]$prefix = '') {
    $list = [System.Collections.Generic.List[PSCustomObject]]::new()
    foreach ($prop in $obj.PSObject.Properties) {
        $path = if ($prefix) { "$prefix.$($prop.Name)" } else { $prop.Name }
        $val  = $prop.Value
        $keys = $val.PSObject.Properties.Name

        if ($keys -contains 'value') {
            $list.Add([PSCustomObject]@{ Path = $path; Value = $val.value; Type = $val.type })
        } else {
            foreach ($child in (Flatten-Tokens $val $path)) { $list.Add($child) }
        }
    }
    return $list
}

# --- COLOR PARSERS: Figma wants r,g,b,a in 0-1 range ---

function Hex-To-Figma([string]$hex) {
    $hex = $hex.TrimStart('#')
    $r   = [Convert]::ToInt32($hex.Substring(0, 2), 16) / 255.0
    $g   = [Convert]::ToInt32($hex.Substring(2, 2), 16) / 255.0
    $b   = [Convert]::ToInt32($hex.Substring(4, 2), 16) / 255.0
    $a   = if ($hex.Length -ge 8) { [Convert]::ToInt32($hex.Substring(6, 2), 16) / 255.0 } else { 1.0 }
    return [ordered]@{ r = [math]::Round($r,6); g = [math]::Round($g,6); b = [math]::Round($b,6); a = [math]::Round($a,6) }
}

function Rgba-To-Figma([string]$rgba) {
    $m = [regex]::Match($rgba, 'rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+))?\s*\)')
    if (-not $m.Success) { return $null }
    $r = [double]$m.Groups[1].Value / 255.0
    $g = [double]$m.Groups[2].Value / 255.0
    $b = [double]$m.Groups[3].Value / 255.0
    $a = if ($m.Groups[4].Success) { [double]$m.Groups[4].Value } else { 1.0 }
    return [ordered]@{ r = [math]::Round($r,6); g = [math]::Round($g,6); b = [math]::Round($b,6); a = [math]::Round($a,6) }
}

function Parse-Color([string]$value) {
    if ($value.StartsWith('#'))                                  { return Hex-To-Figma  $value }
    if ($value.StartsWith('rgba') -or $value.StartsWith('rgb')) { return Rgba-To-Figma $value }
    return $null
}

# --- TYPE MAPPING: token type -> Figma resolved type ---

function Get-FigmaType([string]$tokenType, [string]$tokenPath) {
    switch ($tokenType) {
        'color'         { return 'COLOR'  }
        'fontSizes'     { return 'FLOAT'  }
        'fontWeights'   { return 'FLOAT'  }
        'lineHeights'   { return 'FLOAT'  }
        'fontFamilies'  { return 'STRING' }
        'spacing'       { return 'FLOAT'  }
        'borderRadius'  { return 'FLOAT'  }
        'borderWidth'   { return 'FLOAT'  }
        'letterSpacing' { return $null    }
        'boxShadow'     { return $null    }
        'other' {
            if ($tokenPath -like 'animation.duration.*') { return 'FLOAT'  }
            if ($tokenPath -like 'animation.easing.*')   { return 'STRING' }
            if ($tokenPath -like 'zIndex.*')              { return 'FLOAT'  }
            return $null
        }
        default { return $null }
    }
}

# --- VALUE CONVERSION: token value -> Figma-ready value ---

function Get-FigmaValue($token) {
    $v = [string]$token.Value
    switch ($token.Type) {
        'color'        { return Parse-Color $v }
        'fontSizes'    { return [double]($v -replace 'px','') }
        'fontWeights'  { return [double]$v }
        'lineHeights'  { return [double]$v }
        'fontFamilies' { return ($v.Split(',')[0] -replace "'", '' -replace '"','').Trim() }
        'spacing'      { return [double]($v -replace 'px','') }
        'borderRadius' { return [double]($v -replace 'px','') }
        'borderWidth'  { return [double]($v -replace 'px','') }
        'other' {
            if ($token.Path -like 'animation.duration.*') { return [double]($v -replace 'ms','') }
            if ($token.Path -like 'animation.easing.*')   { return $v }
            if ($token.Path -like 'zIndex.*')              { return [double]$v }
        }
    }
    return $null
}

# --- RESOLVE: alias reference or direct color ---

function Resolve-Value([string]$rawValue, [hashtable]$pathToId) {
    if ($rawValue -match '^\{(.+)\}$') {
        $refPath = $Matches[1]
        if ($pathToId.ContainsKey($refPath)) {
            return [ordered]@{ type = 'VARIABLE_ALIAS'; id = $pathToId[$refPath] }
        }
        Write-Warning "Unresolved alias: $rawValue"
        return $null
    }
    return Parse-Color $rawValue
}

# --- TEMP ID FACTORY ---
# Figma requires temp IDs: start with a letter, alphanumeric + hyphens only

$script:idSeq = 0
function New-Id([string]$hint = 'x') {
    $script:idSeq++
    $safe = ($hint -replace '[^a-zA-Z0-9-]', '-') -replace '--+', '-'
    return "t-$safe-$($script:idSeq)"
}

# --- BUILD PAYLOAD ---

$colList  = [System.Collections.Generic.List[object]]::new()
$modList  = [System.Collections.Generic.List[object]]::new()
$varList  = [System.Collections.Generic.List[object]]::new()
$valList  = [System.Collections.Generic.List[object]]::new()
$pathToId = @{}

Write-Host ''
Write-Host '  Building payload...'

# PRIMITIVES COLLECTION

$colPrimId  = New-Id 'col-primitives'
$modePrimId = New-Id 'mode-default'

$colList.Add([ordered]@{ action='CREATE'; id=$colPrimId;  name='Primitives'; initialModeId=$modePrimId })
$modList.Add([ordered]@{ action='CREATE'; id=$modePrimId; name='Default';    variableCollectionId=$colPrimId })

$primSkipped = 0

foreach ($token in (Flatten-Tokens $prims)) {
    $figmaType = Get-FigmaType $token.Type $token.Path
    if (-not $figmaType) { $primSkipped++; continue }

    if ($token.Value -isnot [string] -and $token.Value -isnot [double] -and
        $token.Value -isnot [int]    -and $token.Value -isnot [long]) {
        $primSkipped++; continue
    }

    $figmaVal = Get-FigmaValue $token
    if ($null -eq $figmaVal) { $primSkipped++; continue }

    $varId   = New-Id "prim-$($token.Path)"
    $varName = $token.Path -replace '\.', '/'

    $pathToId[$token.Path] = $varId

    $varList.Add([ordered]@{ action='CREATE'; id=$varId; name=$varName; variableCollectionId=$colPrimId; resolvedType=$figmaType })
    $valList.Add([ordered]@{ action='UPDATE'; variableId=$varId; modeId=$modePrimId; value=$figmaVal })
}

# SEMANTIC COLLECTION with Light + Dark modes

$colSemId    = New-Id 'col-semantic'
$modeLightId = New-Id 'mode-light'
$modeDarkId  = New-Id 'mode-dark'

$colList.Add([ordered]@{ action='CREATE'; id=$colSemId;    name='Semantic'; initialModeId=$modeLightId })
$modList.Add([ordered]@{ action='CREATE'; id=$modeLightId; name='Light';    variableCollectionId=$colSemId })
$modList.Add([ordered]@{ action='CREATE'; id=$modeDarkId;  name='Dark';     variableCollectionId=$colSemId })

$semPathToId = @{}

foreach ($token in (Flatten-Tokens $light)) {
    if ($token.Type -ne 'color') { continue }
    $varId   = New-Id "sem-$($token.Path)"
    $varName = $token.Path -replace '\.', '/'
    $semPathToId[$token.Path] = $varId
    $varList.Add([ordered]@{ action='CREATE'; id=$varId; name=$varName; variableCollectionId=$colSemId; resolvedType='COLOR' })
}

foreach ($token in (Flatten-Tokens $light)) {
    if ($token.Type -ne 'color') { continue }
    $varId = $semPathToId[$token.Path]
    if (-not $varId) { continue }
    $value = Resolve-Value ([string]$token.Value) $pathToId
    if ($null -eq $value) { continue }
    $valList.Add([ordered]@{ action='UPDATE'; variableId=$varId; modeId=$modeLightId; value=$value })
}

foreach ($token in (Flatten-Tokens $dark)) {
    if ($token.Type -ne 'color') { continue }
    $varId = $semPathToId[$token.Path]
    if (-not $varId) { continue }
    $value = Resolve-Value ([string]$token.Value) $pathToId
    if ($null -eq $value) { continue }
    $valList.Add([ordered]@{ action='UPDATE'; variableId=$varId; modeId=$modeDarkId; value=$value })
}

# --- SUMMARY ---

$primVarCount = ($varList | Where-Object { $_.variableCollectionId -eq $colPrimId }).Count
$semVarCount  = ($varList | Where-Object { $_.variableCollectionId -eq $colSemId  }).Count

Write-Host ''
Write-Host '  Payload summary'
Write-Host '  -----------------------------------------------'
Write-Host ("  Collections  : {0,4}" -f $colList.Count)
Write-Host ("  Modes        : {0,4}" -f $modList.Count)
Write-Host ("  Variables    : {0,4}  ({1} primitives, {2} semantic)" -f $varList.Count, $primVarCount, $semVarCount)
Write-Host ("  Values       : {0,4}" -f $valList.Count)
Write-Host ("  Skipped      : {0,4}  (shadows, letter-spacing, easings)" -f $primSkipped)
Write-Host '  -----------------------------------------------'
Write-Host ''

$confirm = Read-Host "  Send to Figma? (y/n)"
if ($confirm -ne 'y') { Write-Host '  Aborted.'; exit 0 }

# --- CALL FIGMA API ---

$payload = [ordered]@{
    variableCollections = $colList.ToArray()
    variableModes       = $modList.ToArray()
    variables           = $varList.ToArray()
    variableValues      = $valList.ToArray()
}

$body    = $payload | ConvertTo-Json -Depth 20 -Compress
$headers = @{ 'X-FIGMA-TOKEN' = $FigmaToken; 'Content-Type' = 'application/json' }
$url     = "https://api.figma.com/v1/files/$FileKey/variables"

Write-Host ''
Write-Host '  Sending to Figma...'

try {
    $response = Invoke-RestMethod -Method POST -Uri $url -Headers $headers -Body $body -ErrorAction Stop

    Write-Host ''
    Write-Host '  Done!'
    Write-Host ''
    Write-Host '  What to check in Figma:'
    Write-Host '  - Variables panel -> Primitives  (1 mode: Default)'
    Write-Host '  - Variables panel -> Semantic    (2 modes: Light / Dark)'
    Write-Host '  - Semantic tokens show chain icon (alias), not raw hex'
    Write-Host ''
    Write-Host '  To apply dark mode: select a frame -> right panel -> Mode -> Dark'
    Write-Host ''

} catch {
    $errMsg  = $_.Exception.Message
    $errBody = $_.ErrorDetails.Message

    Write-Host ''
    Write-Host "  ERROR: $errMsg"
    if ($errBody) {
        $parsed = $errBody | ConvertFrom-Json -ErrorAction SilentlyContinue
        if ($parsed.err)     { Write-Host "  Figma: $($parsed.err)" }
        if ($parsed.message) { Write-Host "  Figma: $($parsed.message)" }
    }
    Write-Host ''
    Write-Host '  Common causes:'
    Write-Host '  - Invalid token  (check Figma Settings -> Security)'
    Write-Host '  - Wrong file key (from URL: figma.com/file/XXXXXX/...)'
    Write-Host '  - Starter plan   (Variables API requires Figma Pro/Org)'
    Write-Host ''
    exit 1
}
