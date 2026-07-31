# 思考体力室

AIに聞く前の12分。仮説、確信度、根拠分類、反証、判断更新を一つのworkoutとして
体験するpublic canaryです。

## Product boundary

- IQや固定的な能力を測定しません。
- 医学的・心理的効果を主張しません。
- 入力を外部へ送信しません。
- analytics、account、広告、外部AI APIを使用しません。
- 記録は利用者が保存を選んだ場合のみ、そのbrowserの`localStorage`へ残ります。

## Run locally

```bash
npm run dev
```

`http://127.0.0.1:4173/`を開きます。

## Verify

```bash
npm run check
```

## Public site

<https://omr175.github.io/shiko-tairyoku/>
