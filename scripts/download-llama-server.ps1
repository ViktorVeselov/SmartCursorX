param(
    [switch]$Force,
    [switch]$All,
    [string]$Version = "b9682"
)

$ErrorActionPreference = "Stop"

# Install to userData/bin/ — always writable, never synced by OneDrive/Cloud
$dest = "$env:APPDATA\smart-cursor-x\bin"

# Idempotent: skip if already present (unless -Force)
if (((Test-Path "$dest\llama-local-server.exe") -or (Test-Path "$dest\llama-srv.exe")) -and -not $Force) {
    Write-Host "llama server already exists in $dest. Use -Force to re-download."
    exit 0
}

# Stop any running llama processes to avoid file lock issues
Write-Host "Checking for and stopping any running llama-local-server instances..."
Get-Process -Name "llama-local-server", "llama-srv", "llama-server" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1

New-Item -ItemType Directory -Force -Path $dest | Out-Null

$base = "https://github.com/ggml-org/llama.cpp/releases/download/$Version"
$tmpDir = Join-Path $env:TEMP "llama-download-$Version"

# Load compression assembly
Add-Type -AssemblyName System.IO.Compression.FileSystem

function Download-And-Extract($url, $label, $targetDir, $fileFilter) {
    if (-not (Test-Path $tmpDir)) {
        New-Item -ItemType Directory -Force -Path $tmpDir | Out-Null
    }
    $zipFile = Join-Path $tmpDir "$label.zip"

    Write-Host "Downloading $label via curl..."
    curl.exe -k -L -o $zipFile $url

    Write-Host "Extracting $label directly to $targetDir..."
    $zip = [System.IO.Compression.ZipFile]::OpenRead($zipFile)
    try {
        foreach ($entry in $zip.Entries) {
            # Skip directory entries
            if ([string]::IsNullOrEmpty($entry.Name)) { continue; }
            
            # Filter files if filter is provided
            if ($fileFilter) {
                if ($entry.Name -notlike $fileFilter) {
                    continue;
                }
            }

            $targetName = $entry.Name
            if ($targetName -eq "llama-server.exe") {
                $targetName = "llama-srv.exe"
            }
            $targetPath = Join-Path $targetDir $targetName

            # Ensure parent directories for target exist (e.g., if zip has subfolders)
            $parentDir = Split-Path $targetPath -Parent
            if (-not (Test-Path $parentDir)) {
                New-Item -ItemType Directory -Force -Path $parentDir | Out-Null
            }

            [System.IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $targetPath, $true)
        }
    } finally {
        $zip.Dispose()
    }
}

try {
    # Clean up any leftover temp files from failed previous runs
    Remove-Item $tmpDir -Recurse -Force -ErrorAction SilentlyContinue

    # CPU build (required - contains llama-server.exe and all needed DLLs)
    # Extract directly to $dest so that folder exclusions apply immediately
    Download-And-Extract "$base/llama-$Version-bin-win-cpu-x64.zip" "cpu" $dest $null
    Write-Host "Installed CPU build (llama-local-server.exe + DLLs)"

    # Vulkan backend (universal GPU support - NVIDIA, AMD, Intel)
    # Extract only ggml-vulkan.dll directly to $dest
    Download-And-Extract "$base/llama-$Version-bin-win-vulkan-x64.zip" "vulkan" $dest "ggml-vulkan.dll"
    Write-Host "Installed Vulkan backend (ggml-vulkan.dll)"

    # CUDA backend (NVIDIA GPU acceleration)
    if ($All) {
        Download-And-Extract "$base/llama-$Version-bin-win-cuda-12.4-x64.zip" "cuda" $dest "ggml-cuda.dll"
        Write-Host "Installed CUDA backend (ggml-cuda.dll)"

        # CUDA runtime (needed if CUDA not installed system-wide)
        Download-And-Extract "$base/cudart-llama-bin-win-cuda-12.4-x64.zip" "cudart" $dest "*.dll"
        Write-Host "Installed CUDA runtime DLLs"
    }

    # HIP backend (AMD Radeon GPU acceleration)
    if ($All) {
        Download-And-Extract "$base/llama-$Version-bin-win-hip-radeon-x64.zip" "hip" $dest "*.dll"
        Write-Host "Installed HIP backend (ggml-hip.dll + ROCm DLLs)"
    }

    # Clean up
    Remove-Item $tmpDir -Recurse -Force -ErrorAction SilentlyContinue

    $files = Get-ChildItem $dest | Measure-Object
    $totalSize = (Get-ChildItem $dest | Measure-Object -Property Length -Sum).Sum / 1MB
    Write-Host ""
    Write-Host "Done! Installed $($files.Count) files ($([math]::Round($totalSize, 1)) MB) to $dest"
    Write-Host "llama-srv.exe is ready for local model inference."
} catch {
    $err = $_
    # Prevent terminating error under $ErrorActionPreference = "Stop" so we can output context
    $ErrorActionPreference = "Continue"

    Write-Host ""
    Write-Host "========================================= ERROR =========================================" -ForegroundColor Red
    Write-Host "Download failed: $err" -ForegroundColor Red
    Write-Host "Detailed exception: $($err.Exception.ToString())" -ForegroundColor Yellow

    if ($err.Exception.Message -match "Access to the path.*denied" -or $err.Exception.Message -match "UnauthorizedAccess" -or $err.Exception.InnerException.Message -match "Access to the path.*denied" -or $err.Exception.Message -match "denied") {
        Write-Host ""
        Write-Host "----------------------------------------------------------------------------------------" -ForegroundColor Cyan
        Write-Host "🛡️ ANTIVIRUS OR ACCESS BLOCK DETECTED!" -ForegroundColor Red
        Write-Host "Norton, Windows Defender, or another antivirus program blocked writing/extracting the executable." -ForegroundColor White
        Write-Host "To resolve this, please perform the following steps:" -ForegroundColor White
        Write-Host ""
        Write-Host "1. Exclude the installation directory in your Antivirus:" -ForegroundColor Yellow
        Write-Host "   Path to exclude: $dest" -ForegroundColor White
        Write-Host "   (Which expands to: C:\Users\lipov\AppData\Roaming\smart-cursor-x\bin)" -ForegroundColor Gray
        Write-Host ""
        Write-Host "2. (If using Norton) Check 'Security History' -> 'Quarantine' or 'Resolved Security Risks'." -ForegroundColor Yellow
        Write-Host "   Look for the blocked 'llama-server.exe' or 'llama-local-server.exe' event." -ForegroundColor White
        Write-Host "   Select 'Options' -> 'Restore & Options' -> 'Exclude this file/program'." -ForegroundColor White
        Write-Host ""
        Write-Host "3. Run the command again with the -Force option to overwrite any partially-written files:" -ForegroundColor Yellow
        Write-Host "   npm run fetch:llama -- -Force" -ForegroundColor White
        Write-Host "----------------------------------------------------------------------------------------" -ForegroundColor Cyan
    }
    exit 1
}
