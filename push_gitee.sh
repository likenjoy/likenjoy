#!/bin/bash
# Gitee 一键推送脚本
# 用法：注册 gitee.com 后创建空仓库，把仓库地址填到下面，然后执行 ./push_gitee.sh
# 例如：GITEE_REPO=https://gitee.com/你的用户名/rwa-exchange.git

GITEE_REPO="${GITEE_REPO:-}"

if [ -z "$GITEE_REPO" ]; then
  echo "请先设置仓库地址：GITEE_REPO=https://gitee.com/用户名/rwa-exchange.git ./push_gitee.sh"
  exit 1
fi

git remote remove gitee 2>/dev/null
git remote add gitee "$GITEE_REPO"
git push -u gitee master
echo "推送完成：$GITEE_REPO"
