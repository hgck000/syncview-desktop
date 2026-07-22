# -*- mode: python ; coding: utf-8 -*-
import os
import re

from PyInstaller.utils.hooks import collect_all
from PyInstaller.utils.win32.versioninfo import (
    FixedFileInfo,
    StringFileInfo,
    StringStruct,
    StringTable,
    VarFileInfo,
    VarStruct,
    VSVersionInfo,
)


raw_version = os.environ.get('SYNCVIEW_VERSION', '0.0.0').lstrip('vV')
version_numbers = [int(value) for value in re.findall(r'\d+', raw_version)[:4]]
version_numbers += [0] * (4 - len(version_numbers))
version_tuple = tuple(version_numbers)
version_text = '.'.join(str(value) for value in version_numbers[:3])

version_info = VSVersionInfo(
    ffi=FixedFileInfo(
        filevers=version_tuple,
        prodvers=version_tuple,
        mask=0x3F,
        flags=0x0,
        OS=0x40004,
        fileType=0x1,
        subtype=0x0,
        date=(0, 0),
    ),
    kids=[
        StringFileInfo([
            StringTable('040904B0', [
                StringStruct('CompanyName', 'hgck000'),
                StringStruct('FileDescription', 'SyncView Desktop'),
                StringStruct('FileVersion', version_text),
                StringStruct('InternalName', 'SyncView'),
                StringStruct('LegalCopyright', 'Copyright (c) 2026 hgck000'),
                StringStruct('OriginalFilename', 'SyncView.exe'),
                StringStruct('ProductName', 'SyncView'),
                StringStruct('ProductVersion', version_text),
                StringStruct(
                    'Comments',
                    'https://github.com/hgck000/syncview-desktop',
                ),
            ]),
        ]),
        VarFileInfo([VarStruct('Translation', [1033, 1200])]),
    ],
)

datas = [('frontend\\dist', 'frontend\\dist')]
binaries = []
hiddenimports = ['h11', 'clr']

# PyWebView and Uvicorn load several Windows/backend modules dynamically.
# Collect them explicitly so a clean machine never depends on the build PC.
for package in ('uvicorn', 'anyio', 'webview', 'pythonnet', 'clr_loader'):
    package_datas, package_binaries, package_hiddenimports = collect_all(package)
    datas += package_datas
    binaries += package_binaries
    hiddenimports += package_hiddenimports

hiddenimports = list(dict.fromkeys(hiddenimports))


a = Analysis(
    ['backend\\run_prod.py'],
    pathex=[],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='SyncView',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=['assets\\SyncView.ico'],
    version=version_info,
)
coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='SyncView',
)
