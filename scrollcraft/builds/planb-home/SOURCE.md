# Source and rollback

- Scrollcraft repository:
  https://github.com/nateherkai/scroll-craft
- Audited commit:
  0b816225945e45380397d6a0487efa3c98916858
- assets/scrollcraft.css SHA-256:
  e19eb3aa73b0944626ca56e6e427c76f44753481e04d60f4bac20e8cf1d7758a
- assets/scrollcraft.js SHA-256:
  9246fbe4e240a63cdaf33111edd724ee66118da87dc44af86039b0d1619164a1

## Plan B baseline

- Live and local baseline commit:
  109be707f9ef459085ce95dc4cc7d5608b349968
- Local annotated rollback tag:
  planb-pre-scrollcraft-20260925
- Candidate branch:
  codex/scrollcraft-planb-home-v2

Production and main are unchanged during review. A future production rollback
should use git revert of the release commit, followed by GitHub Pages build
verification and external readback. Do not force-push or reset.
