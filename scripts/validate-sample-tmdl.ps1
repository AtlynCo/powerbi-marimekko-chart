param(
    [string]$DesktopBin = (Join-Path $env:ProgramFiles 'Microsoft Power BI Desktop\bin'),
    [string]$Definition = (Join-Path $PSScriptRoot '..\samples\AtlynMarimekko.SemanticModel\definition')
)

$ErrorActionPreference = 'Stop'
if ($PSVersionTable.PSEdition -ne 'Desktop') {
    throw 'Run with powershell.exe -NoProfile -NonInteractive -File scripts\validate-sample-tmdl.ps1 (Windows PowerShell 5.1).'
}
$assemblies = foreach ($name in @('Microsoft.PowerBI.Amo.Core.dll', 'Microsoft.PowerBI.Tabular.dll', 'Microsoft.PowerBI.Tabular.Json.dll')) {
    $path = Join-Path $DesktopBin $name
    $assembly = [Reflection.Assembly]::LoadFrom($path)
    [ordered]@{
        path = $path
        assembly = $assembly.FullName
        fileVersion = [Diagnostics.FileVersionInfo]::GetVersionInfo($path).FileVersion
        sha256 = (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant()
    }
}
$folder = (Resolve-Path -LiteralPath $Definition).Path
$database = [Microsoft.AnalysisServices.Tabular.TmdlSerializer]::DeserializeDatabaseFromFolder($folder)
$model = $database.Model
if ($database.CompatibilityLevel -ne 1600 -or $model.Tables.Count -ne 2 -or
    $model.Relationships.Count -ne 0 -or $model.Expressions.Count -ne 0 -or $model.DataSources.Count -ne 0) {
    throw 'Unexpected sample model shape, compatibility level, expression or external data source.'
}
$tables = foreach ($spec in @(
    @{ name = 'ProductRegion'; measure = 'Market Revenue'; segment = 'Region'; order = 'RegionOrder' },
    @{ name = 'BusinessUnitMix'; measure = 'Mix Revenue'; segment = 'BusinessUnit'; order = 'BusinessUnitOrder' }
)) {
    $table = $model.Tables.Find($spec.name)
    if ($null -eq $table -or $table.Columns.Count -ne 5 -or $table.Measures.Count -ne 1 -or $table.Partitions.Count -ne 1) {
        throw "Unexpected table shape: $($spec.name)"
    }
    $measure = $table.Measures.Find($spec.measure)
    if ($null -eq $measure -or $measure.Expression.Trim() -ne "SUM($($spec.name)[Revenue])") {
        throw "Unexpected additive measure: $($spec.name)"
    }
    if ($table.Columns.Find($spec.segment).SortByColumn.Name -ne $spec.order -or
        $table.Columns.Find('Product').SortByColumn.Name -ne 'ProductOrder') {
        throw "Missing model Sort By relationship: $($spec.name)"
    }
    $partition = $table.Partitions[0]
    if ($partition.Mode.ToString() -ne 'Import' -or $partition.Source.GetType().Name -ne 'MPartitionSource' -or
        $partition.Source.Expression -notmatch '#table\(' -or
        $partition.Source.Expression -match 'File\.Contents|Folder\.Files|Web\.Contents|SampleDataFolder') {
        throw "Expected self-contained inline M Import data: $($spec.name)"
    }
    [ordered]@{ name = $table.Name; columns = $table.Columns.Count; measure = $measure.Name; partition = $partition.Name; mode = $partition.Mode.ToString() }
}
[ordered]@{
    validatedAt = [DateTimeOffset]::UtcNow.ToString('o')
    parser = 'Installed Microsoft Power BI Desktop TOM TmdlSerializer.DeserializeDatabaseFromFolder'
    definition = $folder
    compatibilityLevel = $database.CompatibilityLevel
    tables = @($tables)
    externalDataSources = $model.DataSources.Count
    expressions = $model.Expressions.Count
    assemblies = @($assemblies)
    scope = 'Read-only TMDL deserialization and object assertions. No connection, save, refresh, M/DAX evaluation, UI or native rendering.'
} | ConvertTo-Json -Depth 6
