param(
  [Parameter(Mandatory = $true)]
  [string]$Path
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.IO.Compression.FileSystem

$resolved = (Resolve-Path -LiteralPath $Path).Path
$backup = "$resolved.bak"
Copy-Item -LiteralPath $resolved -Destination $backup -Force

$temp = Join-Path ([System.IO.Path]::GetTempPath()) ("prepzo_xlsx_paper_code_" + [guid]::NewGuid())
New-Item -ItemType Directory -Force -Path $temp | Out-Null

function Get-ColName([int]$index) {
  $name = ""
  while ($index -gt 0) {
    $mod = ($index - 1) % 26
    $name = [char]([int][char]'A' + $mod) + $name
    $index = [math]::Floor(($index - 1) / 26)
  }
  return $name
}

function Get-ColIndex([string]$ref) {
  $letters = ($ref -replace '\d', '')
  $index = 0
  foreach ($char in $letters.ToCharArray()) {
    $index = ($index * 26) + ([int][char]$char - [int][char]'A' + 1)
  }
  return $index
}

function Set-CellRef($cell, [int]$colIndex, [int]$rowIndex) {
  $cell.SetAttribute("r", "$(Get-ColName $colIndex)$rowIndex")
}

function New-InlineCell($doc, [int]$colIndex, [int]$rowIndex, [string]$text) {
  $cell = $doc.CreateElement("c", $doc.DocumentElement.NamespaceURI)
  $cell.SetAttribute("r", "$(Get-ColName $colIndex)$rowIndex")
  $cell.SetAttribute("t", "inlineStr")
  $is = $doc.CreateElement("is", $doc.DocumentElement.NamespaceURI)
  $t = $doc.CreateElement("t", $doc.DocumentElement.NamespaceURI)
  $space = $doc.CreateAttribute("xml", "space", "http://www.w3.org/XML/1998/namespace")
  $space.Value = "preserve"
  $t.Attributes.Append($space) | Out-Null
  $t.InnerText = $text
  $is.AppendChild($t) | Out-Null
  $cell.AppendChild($is) | Out-Null
  return $cell
}

function Set-CellText($doc, $cell, [string]$text) {
  $ref = [string]$cell.r
  $cell.RemoveAll()
  if ($ref) {
    $cell.SetAttribute("r", $ref)
  }
  $cell.SetAttribute("t", "inlineStr")
  $is = $doc.CreateElement("is", $doc.DocumentElement.NamespaceURI)
  $t = $doc.CreateElement("t", $doc.DocumentElement.NamespaceURI)
  $space = $doc.CreateAttribute("xml", "space", "http://www.w3.org/XML/1998/namespace")
  $space.Value = "preserve"
  $t.Attributes.Append($space) | Out-Null
  $t.InnerText = $text
  $is.AppendChild($t) | Out-Null
  $cell.AppendChild($is) | Out-Null
}

function Get-CellText($cell, $sharedStrings) {
  if (-not $cell) { return "" }
  if ($cell.t -eq "s") {
    $idx = [int]$cell.v
    if ($idx -ge 0 -and $idx -lt $sharedStrings.Count) { return $sharedStrings[$idx] }
    return ""
  }
  if ($cell.t -eq "inlineStr") { return [string]$cell.InnerText }
  return [string]$cell.v
}

function Get-CellByCol($row, [int]$colIndex) {
  return $row.c | Where-Object { (Get-ColIndex $_.r) -eq $colIndex } | Select-Object -First 1
}

function Insert-CellSorted($row, $cell, [int]$colIndex) {
  $inserted = $false
  foreach ($existing in @($row.c)) {
    if ((Get-ColIndex $existing.r) -gt $colIndex) {
      $row.InsertBefore($cell, $existing) | Out-Null
      $inserted = $true
      break
    }
  }
  if (-not $inserted) {
    $row.AppendChild($cell) | Out-Null
  }
}

function Load-SharedStrings([string]$basePath) {
  $items = @()
  $sharedPath = Join-Path $basePath "xl\sharedStrings.xml"
  if (Test-Path -LiteralPath $sharedPath) {
    [xml]$sharedXml = Get-Content -LiteralPath $sharedPath
    foreach ($si in $sharedXml.sst.si) {
      if ($si.t) {
        $items += [string]$si.InnerText
      } else {
        $text = ""
        foreach ($run in $si.r) { $text += [string]$run.InnerText }
        $items += $text
      }
    }
  }
  return $items
}

function Get-SheetPathByName([string]$basePath, [string]$sheetName) {
  [xml]$workbook = Get-Content -LiteralPath (Join-Path $basePath "xl\workbook.xml")
  [xml]$rels = Get-Content -LiteralPath (Join-Path $basePath "xl\_rels\workbook.xml.rels")
  $sheet = $workbook.workbook.sheets.sheet | Where-Object { $_.name -eq $sheetName } | Select-Object -First 1
  if (-not $sheet) { throw "Sheet not found: $sheetName" }
  $rid = $sheet.GetAttribute("id", "http://schemas.openxmlformats.org/officeDocument/2006/relationships")
  $rel = $rels.Relationships.Relationship | Where-Object { $_.Id -eq $rid } | Select-Object -First 1
  $target = $rel.Target
  if (-not $target.StartsWith("xl/")) { $target = "xl/" + $target }
  return Join-Path $basePath ($target -replace "/", "\")
}

function Add-PaperCodeColumn([string]$sheetPath, [bool]$isEntry, $sharedStrings) {
  [xml]$doc = Get-Content -LiteralPath $sheetPath
  $sheetData = $doc.worksheet.sheetData
  $headerRow = $sheetData.row | Where-Object { $_.r -eq "1" } | Select-Object -First 1

  $headers = @{}
  foreach ($cell in $headerRow.c) {
    $headers[(Get-CellText $cell $sharedStrings)] = Get-ColIndex $cell.r
  }
  if ($headers.ContainsKey("paper_code")) {
    $paperCol = $headers["paper_code"]
  } else {
    $paperCol = $headers["year"] + 1
    foreach ($row in $sheetData.row) {
      $rowNum = [int]$row.r
      foreach ($cell in @($row.c | Sort-Object { Get-ColIndex $_.r } -Descending)) {
        $col = Get-ColIndex $cell.r
        if ($col -ge $paperCol) {
          Set-CellRef $cell ($col + 1) $rowNum
        }
      }
    }
    $paperHeader = New-InlineCell $doc $paperCol 1 "paper_code"
    Insert-CellSorted $headerRow $paperHeader $paperCol
  }

  $headers = @{}
  foreach ($cell in $headerRow.c) {
    $headers[(Get-CellText $cell $sharedStrings)] = Get-ColIndex $cell.r
  }

  foreach ($row in $sheetData.row) {
    $rowNum = [int]$row.r
    if ($rowNum -eq 1) { continue }
    $year = (Get-CellText (Get-CellByCol $row $headers["year"]) $sharedStrings).Trim()
    $question = (Get-CellText (Get-CellByCol $row $headers["question_number"]) $sharedStrings).Trim()
    if (-not $year -or -not $question) { continue }

    $yearText = $year -replace '\.0$', ''
    $qText = $question -replace '\.0$', ''
    $paperCode = "A"

    $paperCell = Get-CellByCol $row $headers["paper_code"]
    if (-not $paperCell) {
      $paperCell = New-InlineCell $doc $headers["paper_code"] $rowNum $paperCode
      Insert-CellSorted $row $paperCell $headers["paper_code"]
    } else {
      Set-CellText $doc $paperCell $paperCode
    }

    if ($isEntry -and $headers.ContainsKey("import_key")) {
      $importCell = Get-CellByCol $row $headers["import_key"]
      if ($importCell) {
        $importKey = (Get-CellText $importCell $sharedStrings).Trim()
        if ($importKey -match '^NEET-(\d{4})-Q(\d{3})$') {
          Set-CellText $doc $importCell "NEET-$($matches[1])-$paperCode-Q$($matches[2])"
        } elseif (-not $importKey -and $qText) {
          Set-CellText $doc $importCell ("NEET-{0}-{1}-Q{2:D3}" -f [int]$yearText, $paperCode, [int]$qText)
        }
      }
    }

    if ($isEntry) {
      foreach ($headerName in @("question_inline_image_path", "option_a_image_path", "option_b_image_path", "option_c_image_path", "option_d_image_path")) {
        if (-not $headers.ContainsKey($headerName)) { continue }
        $cell = Get-CellByCol $row $headers[$headerName]
        $value = (Get-CellText $cell $sharedStrings).Trim()
        if (-not $value) { continue }
        $updated = $value -replace "pyq/neet/$yearText/q", "pyq/neet/$yearText/$paperCode/q"
        Set-CellText $doc $cell $updated
      }
    }
  }

  $doc.Save($sheetPath)
}

try {
  [System.IO.Compression.ZipFile]::ExtractToDirectory($resolved, $temp)
  $sharedStrings = Load-SharedStrings $temp

  Add-PaperCodeColumn (Get-SheetPathByName $temp "PYQ Entry") $true $sharedStrings
  Add-PaperCodeColumn (Get-SheetPathByName $temp "Answer Key") $false $sharedStrings

  $imageSheetPath = Get-SheetPathByName $temp "Image Naming"
  [xml]$imageDoc = Get-Content -LiteralPath $imageSheetPath
  $rows = $imageDoc.worksheet.sheetData.row
  $lastRow = ($rows | ForEach-Object { [int]$_.r } | Measure-Object -Maximum).Maximum
  $newRows = @(
    @("Paper code", "Use A for Paper 1 and AA for Paper 2 of the same year", "2016 Paper 2 = AA"),
    @("Question image", "pyq/neet/{year}/{paper_code}/q{question_number}/question-inline.png", "pyq/neet/2016/AA/q001/question-inline.png"),
    @("Option image", "pyq/neet/{year}/{paper_code}/q{question_number}/option-a.png", "pyq/neet/2016/AA/q001/option-a.png")
  )
  foreach ($values in $newRows) {
    $lastRow += 1
    $row = $imageDoc.CreateElement("row", $imageDoc.DocumentElement.NamespaceURI)
    $row.SetAttribute("r", [string]$lastRow)
    for ($i = 0; $i -lt $values.Count; $i++) {
      $row.AppendChild((New-InlineCell $imageDoc ($i + 1) $lastRow $values[$i])) | Out-Null
    }
    $imageDoc.worksheet.sheetData.AppendChild($row) | Out-Null
  }
  $imageDoc.Save($imageSheetPath)

  $zipPath = "$resolved.tmp"
  if (Test-Path -LiteralPath $zipPath) { Remove-Item -LiteralPath $zipPath -Force }
  [System.IO.Compression.ZipFile]::CreateFromDirectory($temp, $zipPath)
  Move-Item -LiteralPath $zipPath -Destination $resolved -Force
  Write-Output "Updated: $resolved"
  Write-Output "Backup:  $backup"
} finally {
  if (Test-Path -LiteralPath $temp) {
    Remove-Item -LiteralPath $temp -Recurse -Force
  }
}
