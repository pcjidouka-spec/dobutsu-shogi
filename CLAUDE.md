@AGENTS.md

## Claude Code 固有

AGENTS.md に書いてあることはここで繰り返さない。Claude Code だけが解釈できるものに限る。

- ★このディレクトリには `.claude/` の設定もフックも無く、beads も使っていない。
  親ディレクトリ側にはどちらもある。別リポジトリなので issue はそちらで管理する

## Testing

★**このリポジトリにテストフレームワークは無い** (`package.json` の `scripts` は `start` のみ)。
`/ship` などが自動でテストを探しても見つからないので、**「テストなし」を前提に進める**。
最低限の確認は構文チェックで行う:

```bash
node --check server.js && node --check script.js && node --check server_postgresql.js
```

ベースラインは `.migration-test.txt` にある。
★テストフレームワークを勝手に導入しない (人間に確認してから、独立した作業として行う)。
