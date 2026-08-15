{
  description = "skills, extensions, and prompts for pi coding agent";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    llm-agents.url = "github:numtide/llm-agents.nix";
    treefmt-nix.url = "github:numtide/treefmt-nix";
    treefmt-nix.inputs.nixpkgs.follows = "nixpkgs";
    nixbot.url = "github:Mic92/nixbot";
    nixbot.inputs.nixpkgs.follows = "nixpkgs";
    nixbot.inputs.treefmt-nix.follows = "treefmt-nix";
  };

  outputs =
    {
      self,
      nixpkgs,
      llm-agents,
      treefmt-nix,
      nixbot,
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
        types: path:
        builtins.attrNames (
          nixpkgs.lib.filterAttrs (
            name: fileType: builtins.elem fileType types && !nixpkgs.lib.hasPrefix "." name
          ) (builtins.readDir path)
        );

      skills = namesOf [ "directory" ] ./skills;
      prompts = namesOf [ "regular" ] ./prompts;
      themes = namesOf [ "regular" ] ./themes;
      extensions = namesOf [
        "directory"
        "regular"
      ] ./extensions;

      package =
        pkgs:
        pkgs.stdenvNoCC.mkDerivation {
          pname = "pi-pack";
          version = "0.1.0";
          src = ./.;

          installPhase = ''
            runHook preInstall
            mkdir -p $out/share/pi-pack
            cp -r README.md LICENSE skills prompts extensions themes $out/share/pi-pack/
            runHook postInstall
          '';

          meta = {
            description = "skills, extensions, and prompts for pi coding agent";
            license = pkgs.lib.licenses.mit;
          };
        };

      sedimentPackage = pkgs: pkgs.callPackage ./packages/sediment/package.nix { };

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
        sediment = sedimentPackage pkgs;
      });

      checks = eachSystem (pkgs: {
        package = package pkgs;
        sediment = sedimentPackage pkgs;
        extension-tests = pkgs.runCommand "pi-pack-extension-tests" { nativeBuildInputs = [ pkgs.bun ]; } ''
          cp -r ${self} source
          chmod -R u+w source
          cd source
          HOME=$TMPDIR bun --preload ./tests/preload.ts ./tests/run.ts
          touch $out
        '';
        pi-compatibility =
          pkgs.runCommand "pi-pack-pi-compatibility"
            { nativeBuildInputs = [ llm-agents.packages.${pkgs.stdenv.hostPlatform.system}.pi ]; }
            ''
              cp -r ${self} source
              chmod -R u+w source
              cd source

              mkdir -p "$TMPDIR/home" "$TMPDIR/agent"
              extensions=()
              for extension in extensions/*.ts extensions/*/index.ts; do
                extensions+=(--extension "$PWD/$extension")
              done

              printf '%s\n' '{"type":"get_commands","id":"smoke"}' |
                HOME="$TMPDIR/home" PI_CODING_AGENT_DIR="$TMPDIR/agent" \
                  pi --offline --mode rpc --no-session --no-approve \
                    --no-extensions "''${extensions[@]}" --no-skills \
                    --no-prompt-templates --no-themes \
                    --theme "$PWD/themes/grey-amber.json" \
                    --theme "$PWD/themes/grey-teal.json" --use-theme grey-teal \
                    --no-context-files > "$TMPDIR/pi-rpc.jsonl"

              grep -q '"id":"smoke".*"success":true' "$TMPDIR/pi-rpc.jsonl"
              touch $out
            '';
        formatting = treefmtEval.${pkgs.stdenv.hostPlatform.system}.config.build.check self;
      });

      lib = {
        inherit
          skills
          prompts
          extensions
          themes
          ;
      };

      homeModules.default = import ./nix/home-manager.nix {
        inherit
          self
          extensions
          skills
          prompts
          themes
          ;
      };

      formatter = eachSystem (pkgs: treefmtEval.${pkgs.stdenv.hostPlatform.system}.config.build.wrapper);

      # nixbot scheduled effects
      herculesCI = import ./nix/effects.nix {
        pkgs = nixpkgs.legacyPackages.x86_64-linux;
        inherit nixbot;
      };
    };
}
