; installer.iss — SyncView Desktop (FIXED: package full PyInstaller onedir)

; Build:
;   iscc installer.iss /DMyAppVersion=1.2.0
; Notes:
; - MUST ship the entire dist\SyncView folder (SyncView.exe + _internal\**).
; - This fixes "No module named uvicorn" caused by missing Python packages at runtime.

#ifndef MyAppVersion
  #define MyAppVersion "0.0.0"
#endif

#define MyAppName "SyncView"
#define MyAppExeName "SyncView.exe"
#define MyAppPublisher "SyncView"
#define MyAppId "{{9D4C2D3F-6A90-4F9B-9D8A-0C1B2A8A3E9F}}"  ; change GUID if you cloned

[Setup]
AppId={#MyAppId}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppVerName={#MyAppName} {#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={autopf}\{#MyAppName}
DefaultGroupName={#MyAppName}
OutputDir=Output
OutputBaseFilename={#MyAppName}-{#MyAppVersion}-Setup
Compression=lzma2
SolidCompression=yes
DisableProgramGroupPage=yes
ArchitecturesInstallIn64BitMode=x64
WizardStyle=modern

; Icons
SetupIconFile=assets\SyncView.ico
UninstallDisplayIcon={app}\{#MyAppExeName}

; (optional) keep settings on uninstall? if yes, remove [UninstallDelete] below
; DisableDirPage=no

[Tasks]
Name: "desktopicon"; Description: "Create a &desktop shortcut"; GroupDescription: "Additional icons:"; Flags: unchecked

[Files]
; IMPORTANT: copy the WHOLE onedir output (including _internal + python libs)
Source: "dist\SyncView\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

; The CI downloads Microsoft's official Evergreen Bootstrapper before running
; Inno Setup. It keeps this installer small while supporting clean machines.
Source: "assets\MicrosoftEdgeWebView2Setup.exe"; DestDir: "{tmp}"; Flags: ignoreversion deleteafterinstall

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; WorkingDir: "{app}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon; WorkingDir: "{app}"

[Run]
; The bootstrapper self-detects an existing runtime and downloads only when needed.
Filename: "{tmp}\MicrosoftEdgeWebView2Setup.exe"; Parameters: "/silent /install"; StatusMsg: "Installing Microsoft WebView2 Runtime..."; Flags: waituntilterminated runhidden

[UninstallDelete]
Type: filesandordirs; Name: "{userappdata}\.syncview"
