; Oursum — Inno Setup installer script
; Compiled by CI: ISCC.exe /DMyAppVersion=X.Y.Z scripts\installer.iss
; Requires Inno Setup 6 (pre-installed on GitHub Actions windows-latest)

#define MyAppName      "Oursum"
#define MyAppPublisher "CarthyWorks"
#define MyAppURL       "https://oursum.app"
#define MyAppExeName   "Oursum.exe"

[Setup]
AppId={{A3F7B2C1-D94E-4A08-BC56-7E1234ABCDEF}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}
DefaultDirName={autopf}\{#MyAppName}
DefaultGroupName={#MyAppName}
AllowNoIcons=yes
; Run elevated but allow user to downgrade to per-user if they prefer
PrivilegesRequiredOverridesAllowed=dialog
OutputDir={#SourcePath}\..\artifacts
OutputBaseFilename=Oursum-beta-{#MyAppVersion}-win-x64
SetupIconFile={#SourcePath}\..\icon.ico
Compression=lzma
SolidCompression=yes
WizardStyle=modern
; Minimum Windows 10
MinVersion=10.0

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked
Name: "quicklaunchicon"; Description: "{cm:CreateQuickLaunchIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked; OnlyBelowVersion: 6.1; Check: not IsAdminInstallMode

[Files]
Source: "{#SourcePath}\..\build\stable-win-x64\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{group}\{cm:UninstallProgram,{#MyAppName}}"; Filename: "{uninstallexe}"
Name: "{commondesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon
Name: "{userappdata}\Microsoft\Internet Explorer\Quick Launch\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: quicklaunchicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "{cm:LaunchProgram,{#MyAppName}}"; Flags: nowait postinstall skipifsilent
