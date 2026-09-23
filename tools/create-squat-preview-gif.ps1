param(
  [string]$FrameDirectory = (Join-Path $PSScriptRoot '..\artifacts\male-squat-preview-frames'),
  [string]$OutputPath = (Join-Path $PSScriptRoot '..\artifacts\male-squat-preview.gif')
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName PresentationCore

$frames = @(Get-ChildItem -LiteralPath $FrameDirectory -Filter 'frame-*.png' | Sort-Object Name)
if ($frames.Count -lt 2) {
  throw "Expected rendered squat frames in $FrameDirectory"
}

$encoder = [System.Windows.Media.Imaging.GifBitmapEncoder]::new()
foreach ($file in $frames) {
  $source = [System.Windows.Media.Imaging.BitmapImage]::new()
  $source.BeginInit()
  $source.UriSource = [Uri]$file.FullName
  $source.CacheOption = [System.Windows.Media.Imaging.BitmapCacheOption]::OnLoad
  $source.EndInit()
  $source.Freeze()

  $metadata = [System.Windows.Media.Imaging.BitmapMetadata]::new('gif')
  # GIF delay is measured in centiseconds; 4 approximates the source 24 fps.
  $metadata.SetQuery('/grctlext/Delay', [uint16]4)
  $metadata.SetQuery('/grctlext/Disposal', [byte]2)
  $encoder.Frames.Add([System.Windows.Media.Imaging.BitmapFrame]::Create($source, $source.Thumbnail, $metadata, $source.ColorContexts))
}

$directory = Split-Path -Parent $OutputPath
New-Item -ItemType Directory -Force -Path $directory | Out-Null
$stream = [System.IO.File]::Open($OutputPath, [System.IO.FileMode]::Create)
try {
  $encoder.Save($stream)
} finally {
  $stream.Dispose()
}

Write-Output "Created $OutputPath with $($frames.Count) frames"
