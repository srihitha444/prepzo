param(
  [Parameter(Mandatory = $true)]
  [string]$Path
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.IO.Compression.FileSystem

$temp = Join-Path ([System.IO.Path]::GetTempPath()) ("prepzo_xlsx_inspect_" + [guid]::NewGuid())
New-Item -ItemType Directory -Force -Path $temp | Out-Null

try {
  [System.IO.Compression.ZipFile]::ExtractToDirectory($Path, $temp)

  [xml]$workbook = Get-Content -LiteralPath (Join-Path $temp "xl\workbook.xml")
  [xml]$rels = Get-Content -LiteralPath (Join-Path $temp "xl\_rels\workbook.xml.rels")

  $sharedStrings = @()
  $sharedPath = Join-Path $temp "xl\sharedStrings.xml"
  if (Test-Path -LiteralPath $sharedPath) {
    [xml]$sharedXml = Get-Content -LiteralPath $sharedPath
    foreach ($si in $sharedXml.sst.si) {
      if ($si.t) {
        $sharedStrings += [string]$si.InnerText
      } else {
        $text = ""
        foreach ($run in $si.r) {
          $text += [string]$run.InnerText
        }
        $sharedStrings += $text
      }
    }
  }

  function Get-CellText($cell) {
    if ($cell.t -eq "s") {
      $idx = [int]$cell.v
      if ($idx -ge 0 -and $idx -lt $sharedStrings.Count) {
        return $sharedStrings[$idx]
      }
      return ""
    }
    if ($cell.t -eq "inlineStr") {
      return [string]$cell.InnerText
    }
    return [string]$cell.v
  }

  foreach ($sheet in $workbook.workbook.sheets.sheet) {
    $rid = $sheet.GetAttribute("id", "http://schemas.openxmlformats.org/officeDocument/2006/relationships")
    $rel = $rels.Relationships.Relationship | Where-Object { $_.Id -eq $rid } | Select-Object -First 1
    $target = $rel.Target
    if (-not $target.StartsWith("xl/")) {
      $target = "xl/" + $target
    }
    $sheetPath = Join-Path $temp ($target -replace "/", "\")
    [xml]$sheetXml = Get-Content -LiteralPath $sheetPath
    $headerRow = $sheetXml.worksheet.sheetData.row | Where-Object { $_.r -eq "1" } | Select-Object -First 1
    $headers = @()
    foreach ($cell in $headerRow.c) {
      $headers += (Get-CellText $cell)
    }
    [pscustomobject]@{
      Sheet = [string]$sheet.name
      Path = $target
      Headers = ($headers -join " | ")
    }
  }
} finally {
  if (Test-Path -LiteralPath $temp) {
    Remove-Item -LiteralPath $temp -Recurse -Force
  }
}
