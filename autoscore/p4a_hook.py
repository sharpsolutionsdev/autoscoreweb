"""
python-for-android build hook.
Patches the generated AndroidManifest.xml to add:
  - android:supportsPictureInPicture="true"
  - configChanges to handle orientation/size changes in PiP mode
"""
import os


def after_apk_assemble(ctx, arch, build_dir, **kwargs):
    _patch_manifest(build_dir)


def before_apk_assemble(ctx, arch, build_dir, **kwargs):
    _patch_manifest(build_dir)


def _patch_manifest(build_dir):
    for root, _dirs, files in os.walk(build_dir):
        if 'AndroidManifest.xml' in files:
            path = os.path.join(root, 'AndroidManifest.xml')
            try:
                with open(path, 'r') as f:
                    content = f.read()
                if 'supportsPictureInPicture' in content:
                    return
                # Insert PiP attrs into the PythonActivity element
                old = 'android:name="org.kivy.android.PythonActivity"'
                new = (
                    'android:name="org.kivy.android.PythonActivity"\n'
                    '            android:supportsPictureInPicture="true"\n'
                    '            android:configChanges="screenSize|smallestScreenSize'
                    '|screenLayout|orientation"'
                )
                if old in content:
                    content = content.replace(old, new)
                    with open(path, 'w') as f:
                        f.write(content)
            except Exception:
                pass
