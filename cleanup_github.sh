git checkout --orphan latest_branch;
git add -A;
git commit -am "Init commit";
git branch -D master;
git branch -m master;
git push -f origin master;