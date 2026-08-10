{ pkgs ? import <nixpkgs> {} }:

let
  rustupPkg = pkgs.rustup;
  tauriDeps = with pkgs; [
    gcc
    webkitgtk_4_1
    libsoup_3
    gtk3
    cairo
    pango
    gdk-pixbuf
    glib
    librsvg
    openssl
    pkg-config
    dbus
    xdotool
  ];
in
pkgs.mkShell {
  buildInputs = with pkgs; [
    # Rust toolchain managed by rustup (stable installed globally on the host)
    rustup
    # C compiler for build scripts (cc linker)
    gcc
    # Tauri Linux system libraries
  ] ++ tauriDeps;

  # Runtime libraries for the built app.
  LD_LIBRARY_PATH = with pkgs; pkgs.lib.concatStringsSep ":" [
    "${webkitgtk_4_1}/lib"
    "${libsoup_3}/lib"
    "${gtk3}/lib"
    "${cairo}/lib"
    "${pango}/lib"
    "${gdk-pixbuf}/lib"
    "${glib}/lib"
    "${librsvg}/lib"
  ];

  shellHook = ''
    echo "Craft dev shell ready."
    rustc --version 2>/dev/null || rustup default stable
  '';
}
