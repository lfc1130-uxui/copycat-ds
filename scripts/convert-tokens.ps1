<#
.SYNOPSIS
  Converts CSS custom properties from foundations.html to Tokens Studio JSON.

.OUTPUTS
  tokens/tokens.json  — ready to import into the Tokens Studio Figma plugin.

.USAGE
  cd C:\Users\lfc11\design-system
  powershell -ExecutionPolicy Bypass -File scripts/convert-tokens.ps1
#>

$ErrorActionPreference = 'Stop'

$InputFile  = Join-Path $PSScriptRoot '..\foundations.html'
$OutputFile = Join-Path $PSScriptRoot '..\tokens\tokens.json'

$SingleLine = [System.Text.RegularExpressions.RegexOptions]::Singleline
$RE         = [System.Text.RegularExpressions.Regex]

# ─────────────────────────────────────────────────────────────────────────────
# EXTRACT THE CONTENT INSIDE A CSS BLOCK (e.g. ":root" or ".dark")
# Tracks brace depth so it isn't fooled by nested rules.
# ─────────────────────────────────────────────────────────────────────────────
function Extract-CSSBlock([string]$css, [string]$selector) {
    $idx = $css.IndexOf($selector)
    if ($idx -lt 0) { return '' }
    $open  = $css.IndexOf('{', $idx)
    if ($open -lt 0) { return '' }
    $depth = 0; $i = $open
    while ($i -lt $css.Length) {
        $ch = $css[$i]
        if     ($ch -eq '{') { $depth++ }
        elseif ($ch -eq '}') { $depth--; if ($depth -eq 0) { return $css.Substring($open + 1, $i - $open - 1) } }
        $i++
    }
    return ''
}

# ─────────────────────────────────────────────────────────────────────────────
# PARSE  --name: value;  LINES  →  ordered hashtable
# ─────────────────────────────────────────────────────────────────────────────
function Parse-CSSVars([string]$block) {
    $vars  = [ordered]@{}
    # Strip /* ... */ comments (Singleline so . matches newlines)
    $clean = $RE::Replace($block, '/\*.*?\*/', '', $SingleLine)
    $re    = $RE::new('--([a-zA-Z0-9-]+)\s*:\s*([^;]+);')
    foreach ($m in $re.Matches($clean)) {
        $vars[$m.Groups[1].Value] = $m.Groups[2].Value.Trim()
    }
    return $vars
}

# ─────────────────────────────────────────────────────────────────────────────
# VARIABLE NAME  →  DOT-SEPARATED TOKEN PATH
# ─────────────────────────────────────────────────────────────────────────────
function Get-TokenPath([string]$name) {
    if ($name -match '^(blue|neutral|green|amber|red)-(.+)$') {
        return "color.$($Matches[1]).$($Matches[2])"
    }
    if ($name.StartsWith('color-')) {
        $rest = $name.Substring(6)
        return 'color.' + ($rest -replace '-', '.')
    }
    if ($name.StartsWith('font-'))      { return 'typography.fontFamily.' + $name.Substring(5) }
    if ($name.StartsWith('text-'))      { return 'typography.fontSize.'   + $name.Substring(5) }
    if ($name.StartsWith('weight-'))    { return 'typography.fontWeight.'  + $name.Substring(7) }
    if ($name.StartsWith('leading-'))   { return 'typography.lineHeight.'  + $name.Substring(8) }
    if ($name.StartsWith('tracking-'))  { return 'typography.letterSpacing.' + $name.Substring(9) }
    if ($name.StartsWith('space-'))     { return 'spacing.'      + $name.Substring(6) }
    if ($name.StartsWith('radius-'))    { return 'borderRadius.' + $name.Substring(7) }
    if ($name.StartsWith('shadow-'))    { return 'boxShadow.'    + $name.Substring(7) }
    if ($name.StartsWith('border-'))    { return 'borderWidth.'  + $name.Substring(7) }
    if ($name.StartsWith('z-'))         { return 'zIndex.'       + $name.Substring(2) }
    if ($name.StartsWith('ease-'))      { return 'animation.easing.'   + $name.Substring(5) }
    if ($name.StartsWith('duration-'))  { return 'animation.duration.' + $name.Substring(9) }
    return $name
}

# ─────────────────────────────────────────────────────────────────────────────
# VARIABLE NAME  →  TOKENS STUDIO TYPE STRING
# ─────────────────────────────────────────────────────────────────────────────
function Get-TokenType([string]$name) {
    if ($name -match '^(blue|neutral|green|amber|red)-') { return 'color' }
    if ($name.StartsWith('color-'))     { return 'color' }
    if ($name.StartsWith('font-'))      { return 'fontFamilies' }
    if ($name.StartsWith('text-'))      { return 'fontSizes' }
    if ($name.StartsWith('weight-'))    { return 'fontWeights' }
    if ($name.StartsWith('leading-'))   { return 'lineHeights' }
    if ($name.StartsWith('tracking-'))  { return 'letterSpacing' }
    if ($name.StartsWith('space-'))     { return 'spacing' }
    if ($name.StartsWith('radius-'))    { return 'borderRadius' }
    if ($name.StartsWith('shadow-'))    { return 'boxShadow' }
    if ($name.StartsWith('border-'))    { return 'borderWidth' }
    return 'other'
}

# ─────────────────────────────────────────────────────────────────────────────
# RESOLVE  var(--name)  TO  {token.path}  REFERENCE
# ─────────────────────────────────────────────────────────────────────────────
function Resolve-Value([string]$value, [hashtable]$varToPath) {
    $m = $RE::Match($value, '^var\(--([a-zA-Z0-9-]+)\)$')
    if ($m.Success -and $varToPath.ContainsKey($m.Groups[1].Value)) {
        return '{' + $varToPath[$m.Groups[1].Value] + '}'
    }
    return $value
}

# ─────────────────────────────────────────────────────────────────────────────
# SHADOW PARSER  →  Tokens Studio boxShadow object or array
# ─────────────────────────────────────────────────────────────────────────────

# Split shadow shorthand on top-level commas (avoids splitting inside rgba(...))
function Split-ShadowLayers([string]$value) {
    $layers = [System.Collections.Generic.List[string]]::new()
    $depth = 0; $start = 0
    for ($i = 0; $i -lt $value.Length; $i++) {
        $ch = $value[$i]
        if     ($ch -eq '(') { $depth++ }
        elseif ($ch -eq ')') { $depth-- }
        elseif ($ch -eq ',' -and $depth -eq 0) {
            $layers.Add($value.Substring($start, $i - $start).Trim())
            $start = $i + 1
        }
    }
    $layers.Add($value.Substring($start).Trim())
    return $layers
}

function Parse-ShadowLayer([string]$raw) {
    $str     = $raw.Trim()
    $isInset = $str.StartsWith('inset')
    $rest    = if ($isInset) { $str.Substring(5).Trim() } else { $str }

    $colorRe = $RE::Match($rest, '(rgba?\([^)]+\)|#[a-fA-F0-9]{3,8})')
    $color   = if ($colorRe.Success) { $colorRe.Value } else { 'rgba(0,0,0,0)' }

    $withoutColor = ($rest -replace $RE::Escape($color), '').Trim()
    $nums = ($withoutColor -split '\s+') | Where-Object { $_ -ne '' }

    return [ordered]@{
        x      = ($nums[0] -replace 'px', '')
        y      = ($nums[1] -replace 'px', '')
        blur   = ($nums[2] -replace 'px', '')
        spread = if ($nums.Count -gt 3) { $nums[3] -replace 'px', '' } else { '0' }
        color  = $color
        type   = if ($isInset) { 'innerShadow' } else { 'dropShadow' }
    }
}

function Parse-ShadowValue([string]$value) {
    if ($value -eq 'none') { return 'none' }
    $layers = @(Split-ShadowLayers $value | ForEach-Object { Parse-ShadowLayer $_ })
    if ($layers.Count -eq 1) { return $layers[0] }
    return $layers
}

# ─────────────────────────────────────────────────────────────────────────────
# SET A VALUE IN A NESTED HASHTABLE VIA DOT PATH
# ─────────────────────────────────────────────────────────────────────────────
function Set-Deep($obj, [string]$dotPath, $value) {
    $parts = $dotPath -split '\.'
    $cur   = $obj
    for ($i = 0; $i -lt ($parts.Count - 1); $i++) {
        $key = $parts[$i]
        if (-not $cur.Contains($key) -or $cur[$key] -isnot [System.Collections.IDictionary]) {
            $cur[$key] = [ordered]@{}
        }
        $cur = $cur[$key]
    }
    $cur[$parts[-1]] = $value
}

# ─────────────────────────────────────────────────────────────────────────────
# BUILD A TOKEN SET  (filter → classify → nest into hashtable)
# ─────────────────────────────────────────────────────────────────────────────
function Build-TokenSet([hashtable]$vars, [hashtable]$varToPath, [scriptblock]$filter) {
    $set = [ordered]@{}
    foreach ($entry in $vars.GetEnumerator()) {
        $name = $entry.Key; $rawValue = $entry.Value
        if (-not (& $filter $name)) { continue }

        $tokenPath = Get-TokenPath  $name
        $type      = Get-TokenType  $name
        $value     = if ($type -eq 'boxShadow') { Parse-ShadowValue $rawValue }
                     else                        { Resolve-Value $rawValue $varToPath }

        Set-Deep $set $tokenPath ([ordered]@{ value = $value; type = $type })
    }
    return $set
}

function Count-Tokens($node) {
    if ($node -is [System.Collections.IDictionary] -and $node.Contains('value')) { return 1 }
    $total = 0
    if ($node -is [System.Collections.IDictionary]) {
        foreach ($v in $node.Values) { $total += Count-Tokens $v }
    }
    return $total
}

# ─────────────────────────────────────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────────────────────────────────────

Write-Host ''
Write-Host '  Converting foundations.html -> tokens.json ...'

if (-not (Test-Path $InputFile)) { Write-Error "Cannot find $InputFile"; exit 1 }

$html = [System.IO.File]::ReadAllText($InputFile, [System.Text.Encoding]::UTF8)

# Extract <style>...</style> using simple string methods (no problematic regex)
$styleOpen  = $html.IndexOf('<style>')
$styleClose = $html.IndexOf('</style>', $styleOpen)
if ($styleOpen -lt 0 -or $styleClose -lt 0) { Write-Error 'No <style> block found.'; exit 1 }
$css = $html.Substring($styleOpen + 7, $styleClose - $styleOpen - 7)

# Parse :root and .dark blocks
$rootVars = Parse-CSSVars (Extract-CSSBlock $css ':root')
$darkVars = Parse-CSSVars (Extract-CSSBlock $css '.dark')

if ($rootVars.Count -eq 0) { Write-Error 'No variables found in :root {}.'; exit 1 }

# Build var-name -> token-path lookup (used to resolve var() references)
$varToPath = @{}
foreach ($name in $rootVars.Keys) { $varToPath[$name] = Get-TokenPath $name }

# Classify variables into the three token sets
$isPrimitive = {
    param($n)
    ($n -match '^(blue|neutral|green|amber|red)-') -or
    $n.StartsWith('font-')     -or $n.StartsWith('text-')    -or
    $n.StartsWith('weight-')   -or $n.StartsWith('leading-') -or
    $n.StartsWith('tracking-') -or $n.StartsWith('space-')   -or
    $n.StartsWith('radius-')   -or $n.StartsWith('shadow-')  -or
    $n.StartsWith('border-')   -or $n.StartsWith('z-')       -or
    $n.StartsWith('ease-')     -or $n.StartsWith('duration-')
}
$isSemantic = { param($n) $n.StartsWith('color-') }

$primitives    = Build-TokenSet $rootVars $varToPath $isPrimitive
$semanticLight = Build-TokenSet $rootVars $varToPath $isSemantic
$semanticDark  = Build-TokenSet $darkVars  $varToPath $isSemantic

# Assemble Tokens Studio output
$output = [ordered]@{
    '$metadata' = [ordered]@{
        tokenSetOrder = @('primitives', 'semantic/light', 'semantic/dark')
    }
    '$themes' = @(
        [ordered]@{
            id    = 'light'; name = 'Light'; group = 'Mode'
            selectedTokenSets = [ordered]@{
                'primitives'      = 'enabled'
                'semantic/light'  = 'enabled'
                'semantic/dark'   = 'disabled'
            }
        },
        [ordered]@{
            id    = 'dark'; name = 'Dark'; group = 'Mode'
            selectedTokenSets = [ordered]@{
                'primitives'      = 'enabled'
                'semantic/light'  = 'disabled'
                'semantic/dark'   = 'enabled'
            }
        }
    )
    'primitives'      = $primitives
    'semantic/light'  = $semanticLight
    'semantic/dark'   = $semanticDark
}

# Write output (depth 20 prevents object truncation in deep nesting)
$null = New-Item -ItemType Directory -Force -Path (Split-Path $OutputFile)
$json = $output | ConvertTo-Json -Depth 20
[System.IO.File]::WriteAllText($OutputFile, $json, [System.Text.Encoding]::UTF8)

# Summary
$pc = Count-Tokens $primitives
$lc = Count-Tokens $semanticLight
$dc = Count-Tokens $semanticDark

Write-Host ''
Write-Host "  + tokens.json written"
Write-Host "    $OutputFile"
Write-Host ''
Write-Host '  Token sets'
Write-Host '  ----------------------------------------'
Write-Host ("  primitives           {0,4} tokens" -f $pc)
Write-Host ("  semantic/light       {0,4} tokens" -f $lc)
Write-Host ("  semantic/dark        {0,4} tokens" -f $dc)
Write-Host '  ----------------------------------------'
Write-Host ("  total                {0,4} tokens" -f ($pc + $lc + $dc))
Write-Host ''
Write-Host '  Next steps:'
Write-Host '  1. Open Figma -> install "Tokens Studio for Figma" plugin'
Write-Host '  2. Plugin panel -> Load from file -> pick tokens/tokens.json'
Write-Host '  3. Use Themes panel to switch between Light / Dark'
Write-Host ''
