# Repository operating agreement

## Mission

「BRAIN GYM」は、生成AIへ答えを委ねる前に、自分で仮説、確信度、根拠、反証を置き、
判断を更新する短いthinking adventureを提供するpublic canaryである。IQ、固定能力、
医学的改善を診断・保証しない。

## Hard rules

- `main`をGitHub Pagesの公開sourceとする。
- account、server、database、analytics、広告、外部AI APIを追加しない。
- user入力をnetworkへ送信しない。保存は明示されたdevice-local stateだけにする。
- light themeを既定とし、dark themeを提供する場合は選択を保持する。
- keyboard focus、screen reader label、reduced motion、mobile layoutを維持する。
- 公開claimはrepository内の実測範囲を超えない。
- Nintendoを含む第三者のcharacter、asset、固有UI、trade dressを模倣しない。
- 公開、課金、個人情報、repository settingsの変更はhuman approvalを必要とする。

## Verification

変更後は`npm run check`を実行し、公開前にGitHub Pages workflowと公開assetを確認する。
