# Gugarythm Package Format Design

## Goal

Replace the SCP-specific web packer with a browser-only packer for Gugarythm. It creates a ZIP-based `.ggr` package without Sonolus engine resources or server-specific data.

## Package layout

```
<song>.ggr
├── manifest.json      required
├── chart.usc          required
├── audio.<extension>  required
├── metadata.json      optional
└── cover.<extension>  optional
```

The package must be a standard ZIP archive. Entry names are fixed and must be flat: nested folders are not accepted in version 1.

### Required files

- `manifest.json` identifies the package format and the paths of the chart and audio files.
- `chart.usc` is the unmodified USC source chart.
- `audio.<extension>` is the user-selected music file. Version 1 accepts MP3, OGG, WAV, M4A, AAC, or FLAC; the manifest records its exact filename.

### Optional files

- `metadata.json` holds user-defined metadata that Gugarythm does not need to parse to open the chart. This preserves future extensibility without changing the core manifest.
- `cover.<extension>` is an optional PNG, JPEG, or WebP image. The manifest records its exact filename. The web packer accepts WebP uploads but normalizes them to a white-background JPEG before packaging.

## Manifest schema

```json
{
  "format": "gugarythm-package",
  "version": 1,
  "title": "DOMiNUS_GRAiL",
  "artist": "xi",
  "author": "Guga",
  "rating": 25,
  "offset": 0,
  "chart": "chart.usc",
  "audio": "audio.mp3",
  "metadata": "metadata.json",
  "cover": "cover.png"
}
```

`format`, `version`, `chart`, and `audio` are required. The title, artist, author, rating, offset, metadata, and cover properties are optional. `offset` is in seconds and is added to any offset defined in the USC file. `metadata` and `cover` are omitted when their files are not selected.

## Packer behavior

The static site keeps the current fields for title, artist, author, rating, and offset, plus required USC and audio inputs. It adds optional inputs for a JSON metadata file and a cover image.

On download, the packer validates the USC as JSON, writes the manifest, and emits a `.ggr` ZIP. It does not convert USC to Sonolus LevelData, fetch an engine template, create SCP records, or upload any file. The download filename is derived from the title.

## Importer contract

Gugarythm validates the ZIP paths and manifest before reading assets. It rejects packages with a missing required entry, unsupported manifest format/version, an invalid USC JSON file, or a manifest path outside the archive. It may ignore an unreadable optional metadata or cover file while reporting a non-blocking warning.

## Verification

- Build a package with USC plus MP3 and verify the ZIP has exactly `manifest.json`, `chart.usc`, and `audio.mp3`.
- Build a package with optional JSON and cover and verify all five entries and manifest paths.
- Verify packaging never adds `sonolus/` entries or embeds the engine template.
- Verify malformed USC JSON, missing audio, and unsupported cover types show clear errors before download.
