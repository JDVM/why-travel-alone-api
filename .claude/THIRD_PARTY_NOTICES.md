# Third-party notices

The subagents in `.claude/agents/` (express-expert, knex-expert, mysql-expert, auth-expert (originally jwt-expert), owasp-top10-expert) are adapted from
[0xfurai/claude-code-subagents](https://github.com/0xfurai/claude-code-subagents)
(commit `9236d10`), used under the MIT License below.

Changes from the originals:

- `model` changed from `claude-sonnet-4-20250514` to `inherit`, so each agent uses the session's model.
- Added a project-specific section (stack, conventions, known gaps, and the checks to run before finishing).
- Removed guidance that conflicts with this project or is out of scope.
- `owasp-top10-expert` (API repo) is restricted to read-only tools.

---

```
MIT License

Copyright (c) 2025 0xfurai

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
