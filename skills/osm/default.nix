{
  lib,
  python3,
}:
python3.pkgs.buildPythonApplication {
  pname = "osm-cli";
  version = "0.1.0";
  pyproject = true;

  src = ./.;

  build-system = [ python3.pkgs.setuptools ];

  nativeCheckInputs = [ python3.pkgs.pytestCheckHook ];

  pythonImportsCheck = [ "osm_cli" ];

  meta = {
    description = "Bounded OpenStreetMap place search for AI agents";
    homepage = "https://github.com/fosskar/pi-pack";
    license = lib.licenses.mit;
    mainProgram = "osm";
  };
}
