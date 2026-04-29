{ pkgs }: {
  deps = [
    pkgs.nodejs_20   # 將此處改為你需要的版本
    pkgs.nodePackages.typescript-language-server
    pkgs.yarn
  ];
}
