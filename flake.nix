{
  description = "skills, extensions, and prompts for pi coding agent";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    treefmt-nix.url = "github:numtide/treefmt-nix";
    treefmt-nix.inputs.nixpkgs.follows = "nixpkgs";
  };

  outputs =
    {
      nixpkgs,
      treefmt-nix,
      ...
    }:
    let
      systems = [
        "x86_64-linux"
        "aarch64-linux"
        "aarch64-darwin"
      ];

      eachSystem = f: nixpkgs.lib.genAttrs systems (system: f nixpkgs.legacyPackages.${system});

      namesOf =
        type: path:
        builtins.attrNames (
          nixpkgs.lib.filterAttrs (name: fileType: fileType == type && !nixpkgs.lib.hasPrefix "." name) (
            builtins.readDir path
          )
        );

      skills = namesOf "directory" ./skills;
      prompts = namesOf "regular" ./prompts;
      extensions = namesOf "regular" ./extensions;

      package =
        pkgs:
        pkgs.stdenvNoCC.mkDerivation {
          pname = "pi-pack";
          version = "0.1.0";
          src = ./.;

          installPhase = ''
            runHook preInstall
            mkdir -p $out/share/pi-pack
            cp -r README.md LICENSE skills prompts extensions $out/share/pi-pack/
            runHook postInstall
          '';

          meta = {
            description = "skills, extensions, and prompts for pi coding agent";
            license = pkgs.lib.licenses.mit;
          };
        };

      treefmtEval = eachSystem (
        pkgs:
        treefmt-nix.lib.evalModule pkgs {
          projectRootFile = "flake.nix";

          settings.global.excludes = [
            "*.gitignore"
            "LICENSE"
            "flake.lock"
            "result"
            "**/result"
          ];

          programs = {
            nixfmt.enable = true;
            prettier.enable = true;
            deadnix.enable = true;
            statix.enable = true;
          };
        }
      );

    in
    {
      packages = eachSystem (pkgs: {
        default = package pkgs;
      });

      lib = {
        inherit skills prompts extensions;
      };

      formatter = eachSystem (pkgs: treefmtEval.${pkgs.stdenv.hostPlatform.system}.config.build.wrapper);
    };
}
