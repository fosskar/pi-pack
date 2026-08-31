# the deployed extension carries an absolute store path to sediment
# instead of relying on PATH: a bare launch environment (systemd unit,
# minimal exec) would otherwise trip binaryMissing and turn memory off
# silently. non-nix consumers of the raw source keep the PATH fallback.
{
  runCommand,
  sediment,
}:
runCommand "pi-pack-sediment-memory" { src = ../../../extensions/sediment-memory; } ''
  cp -r $src $out
  chmod -R u+w $out
  substituteInPlace $out/sediment.ts \
    --replace-fail '@SEDIMENT_BIN@' '${sediment}/bin/sediment'
''
