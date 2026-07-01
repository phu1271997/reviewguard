# Suggested commit sequence (Engineering axis)

Tell the development story; don't push one giant "init" commit.

```bash
git init
git add README.md .gitignore contracts/storage_test.py
git commit -m "scaffold repo + minimal storage sanity contract"

git add contracts/ReviewGuard.py
git commit -m "ReviewGuard: Analysis struct + str-keyed storage"

git commit --allow-empty -m "analyze(): read review page on-chain + LLM authenticity grading"

git commit --allow-empty -m "consensus via eq_principle.prompt_comparative (agree on verdict meaning)"

git commit --allow-empty -m "edge cases: unreachable page + malformed JSON -> UNRESOLVABLE"

git add frontend/
git commit -m "genlayer-js + React frontend: analyze flow, trust gauge, history"

git add scripts/ COMMITS.md
git commit -m "scripted testnet deploy + docs"
```

After deploying on Studio and getting the address (Antigravity step):

```bash
echo "VITE_CONTRACT_ADDRESS=0xYOURADDRESS" > frontend/.env
git add frontend/.env.example
git commit -m "wire frontend to deployed contract address"
git push
```
