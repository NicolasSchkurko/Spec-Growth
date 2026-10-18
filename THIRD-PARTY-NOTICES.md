# Third-party notices

This repository is distributed under the MIT license (see `LICENSE`). It
adapts code from the following projects; their notices are reproduced here as
required by their licenses.

## Ponytail

- Source: https://github.com/DietrichGebert/ponytail
- License: MIT
- Adapted in: `assets/scripts/build-map.mjs` (and its copies in
  `quality/conformance/template/scripts/gates/`), a port of
  `hooks/ponytail-map.js`.
- Notes: the adaptation keeps the idea (a character-budgeted, regex-based map of
  folders to exported names) and changes the patterns (Kotlin/JVM modifiers),
  the environment variable (`SPEC_GROWTH_MAP_CHARS`) and the output wording.

```
MIT License

Copyright (c) 2026 DietrichGebert

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Runtime dependencies (not vendored)

- OpenCode — MIT — https://github.com/anomalyco/opencode
- OpenSpec — MIT — https://github.com/Fission-AI/OpenSpec

They are required at runtime but no source from them is included in this
repository.
