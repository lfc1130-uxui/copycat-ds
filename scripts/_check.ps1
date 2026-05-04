$errors = $null
$tokens = $null

# Check line 30 for non-ASCII bytes
$bytes  = [System.IO.File]::ReadAllBytes('C:\Users\lfc11\design-system\scripts\push-to-figma.ps1')
$text   = [System.IO.File]::ReadAllText('C:\Users\lfc11\design-system\scripts\push-to-figma.ps1', [System.Text.Encoding]::UTF8)
$lines  = $text -split "`n"

Write-Host "Line 30: $($lines[29])"
Write-Host "Non-ASCII chars on line 30:"
$l = $lines[29]
for ($i = 0; $i -lt $l.Length; $i++) {
    $c = [int][char]$l[$i]
    if ($c -gt 127) { Write-Host ("  pos {0}: U+{1:X4} ({2})" -f $i, $c, $l[$i]) }
}

# Check all lines for non-ASCII
Write-Host ""
Write-Host "All lines with non-ASCII chars:"
for ($ln = 0; $ln -lt $lines.Count; $ln++) {
    $hasNonAscii = $false
    foreach ($ch in $lines[$ln].ToCharArray()) {
        if ([int][char]$ch -gt 127) { $hasNonAscii = $true; break }
    }
    if ($hasNonAscii) { Write-Host ("  Line {0,3}: {1}" -f ($ln+1), $lines[$ln].Trim()) }
}
