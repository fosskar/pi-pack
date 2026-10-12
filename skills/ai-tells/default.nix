{
  fetchzip,
  linkFarm,
  writeText,
  writeShellApplication,
  vale,
  valeStyles,
}:
let
  version = "1.37.0";
  release = "https://github.com/tbhb/vale-ai-tells/releases/download/v${version}";

  # ai-tells.zip holds styles/{ai-tells,config}, ai-tells-commits.zip bare rule files
  aiTells = fetchzip {
    url = "${release}/ai-tells.zip";
    hash = "sha256-c8J9B6sv4DlEpI3w6jVik8ughU3iqyc8X5IJZnhr1v4=";
  };
  aiTellsCommits = fetchzip {
    url = "${release}/ai-tells-commits.zip";
    stripRoot = false;
    hash = "sha256-WSHkPE7jq9MtizQuFsoY0nn2qi/AstR9iVbN9gHcvvU=";
  };

  styles = linkFarm "vale-ai-tells-styles" [
    {
      name = "ai-tells";
      path = "${aiTells}/styles/ai-tells";
    }
    {
      name = "ai-tells-commits";
      path = aiTellsCommits;
    }
    {
      name = "proselint";
      path = "${valeStyles.proselint}/share/vale/styles/proselint";
    }
    {
      name = "config";
      path = "${aiTells}/styles/config";
    }
  ];

  config = writeText "ai-tells.vale.ini" ''
    StylesPath = ${styles}
    MinAlertLevel = suggestion

    [formats]
    COMMIT_EDITMSG = md

    [*]
    BasedOnStyles = ai-tells, proselint

    [*COMMIT_EDITMSG]
    BasedOnStyles = ai-tells, ai-tells-commits, proselint
  '';
in
writeShellApplication {
  name = "ai-tells";
  runtimeInputs = [ vale ];
  text = ''
    exec vale --config ${config} --output ${styles}/config/templates/ai-tells-agent.tmpl "$@"
  '';
}
