param(
  [Parameter(Mandatory = $true)]
  [string]$Path
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.IO.Compression.FileSystem

$temp = Join-Path ([System.IO.Path]::GetTempPath()) ("prepzo_xlsx_summary_" + [guid]::NewGuid())
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
      if ($idx -ge 0 -and $idx -lt $sharedStrings.Count) { return $sharedStrings[$idx] }
      return ""
    }
    if ($cell.t -eq "inlineStr") { return [string]$cell.InnerText }
    return [string]$cell.v
  }

  function ColNameToIndex([string]$ref) {
    $letters = ($ref -replace '\d', '')
    $index = 0
    foreach ($char in $letters.ToCharArray()) {
      $index = ($index * 26) + ([int][char]$char - [int][char]'A' + 1)
    }
    return $index
  }

  foreach ($sheet in $workbook.workbook.sheets.sheet) {
    if ($sheet.name -notin @("PYQ Entry", "Answer Key")) { continue }
    $rid = $sheet.GetAttribute("id", "http://schemas.openxmlformats.org/officeDocument/2006/relationships")
    $rel = $rels.Relationships.Relationship | Where-Object { $_.Id -eq $rid } | Select-Object -First 1
    $target = $rel.Target
    if (-not $target.StartsWith("xl/")) { $target = "xl/" + $target }
    [xml]$sheetXml = Get-Content -LiteralPath (Join-Path $temp ($target -replace "/", "\"))

    $headerRow = $sheetXml.worksheet.sheetData.row | Where-Object { $_.r -eq "1" } | Select-Object -First 1
    $headers = @{}
    foreach ($cell in $headerRow.c) {
      $headers[(Get-CellText $cell)] = ColNameToIndex $cell.r
    }

    $rows = @()
    foreach ($row in $sheetXml.worksheet.sheetData.row) {
      if ([int]$row.r -eq 1) { continue }
      $obj = [ordered]@{ row = [int]$row.r }
      foreach ($name in @("import_key", "exam", "year", "paper_code", "question_number", "correct_option", "notes")) {
        if (-not $headers.ContainsKey($name)) { continue }
        $targetIndex = $headers[$name]
        $cell = $row.c | Where-Object { (ColNameToIndex $_.r) -eq $targetIndex } | Select-Object -First 1
        $obj[$name] = if ($cell) { Get-CellText $cell } else { "" }
      }
      $rows += [pscustomobject]$obj
    }

    $years = $rows | Group-Object year | Sort-Object Name | ForEach-Object { "$($_.Name):$($_.Count)" }
    Write-Output "[$($sheet.name)] rows=$($rows.Count) years=$($years -join ', ')"
    $rows | Select-Object -First 5 | Format-Table -AutoSize | Out-String | Write-Output
    $rows | Where-Object { $_.year -eq "2016" } | Select-Object -First 5 | Format-Table -AutoSize | Out-String | Write-Output
  }
} finally {
  if (Test-Path -LiteralPath $temp) {
    Remove-Item -LiteralPath $temp -Recurse -Force
  }
}
