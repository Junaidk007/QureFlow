# Akshara Dixit

## About Me

I am a BTech Computer Science student currently in my second year.
I am interested in learning backend and AI.
I enjoy learning by building practical projects and improving my problem-solving skills.
I am currently strengthening my programming, Git, GitHub, and development skills.

---

## GitHub Experience

I have basic experience with Git and GitHub, including cloning repositories, creating branches, making commits, and pushing changes to remote repositories.

This task helped me understand the complete collaborative workflow of contributing to an existing GitHub repository through a fork, feature branch, and pull request.

---

## Understanding the GitHub Workflow

The Track B workflow can be represented as:

```text
                    ORIGINAL REPOSITORY
                    Junaidk007/QureFlow
                           │
                           │ Fork
                           ▼
                    MY GITHUB FORK
                 dixitakshara96/QureFlow
                           │
                           │ Clone
                           ▼
                    LOCAL REPOSITORY
                           │
                           │ Create branch
                           ▼
                 add-akshara-intro
                           │
                           │ Add my changes
                           ▼
                    Commit changes
                           │
                           │ Push
                           ▼
                 MY GITHUB FORK
                 add-akshara-intro
                           │
                           │ Pull Request
                           ▼
                    ORIGINAL REPOSITORY
                    Junaidk007/QureFlow
```

### Why do we create a fork?

A fork creates my own GitHub copy of the mentor's repository.

I use a fork because I do not directly modify the mentor's repository. Instead, I make my changes in my own repository and then propose those changes to the original repository through a pull request.

This gives the original repository a safe and controlled contribution workflow.

---

## Why do we use `upstream`?

There are two important remote repositories in this workflow:

```text
origin   → my fork
upstream → original mentor repository
```

In my case:

```text
origin
https://github.com/dixitakshara96/QureFlow.git

upstream
https://github.com/Junaidk007/QureFlow.git
```

`origin` points to my fork, so it is where I push my feature branch.

`upstream` points to the original mentor repository. It identifies the repository from which my fork originated and can be used to obtain changes from the original repository in the future.

The important distinction is:

```text
origin   = my copy
upstream = original project
```

---

## Why do we create a separate branch?

I created the branch:

```text
add-akshara-intro
```

Instead of making changes directly on `main`.

The branch gives my work a separate line of development:

```text
main
 │
 │
 └───────────────┐
                 │
                 ▼
          add-akshara-intro
                 │
                 │ My changes
                 ▼
              Commit
```

This keeps the main branch protected from unfinished or experimental changes.

It also makes my contribution easier to review because the pull request contains only the changes related to this task.

---

## How I Completed This Task

1. Forked the mentor's QureFlow repository to my GitHub account.
2. Cloned my fork to my local machine.
3. Verified that `origin` points to my fork.
4. Added the mentor repository as the `upstream` remote.
5. Created a feature branch named `add-akshara-intro`.
6. Created this Markdown file in the repository root.
7. Reviewed the changes before committing.
8. Staged and committed the Markdown file.
9. Pushed the feature branch to my GitHub fork.
10. Opened a pull request from my feature branch to the mentor repository.

---

## What I Learned

1. **Repository** — A repository is a project tracked using Git. It contains the project's files and Git history.

2. **Fork** — A fork is my GitHub copy of another repository. It allows me to work on the project without directly modifying the original repository.

3. **Branch** — A branch is a separate line of development. I used a feature branch so that my changes stayed separate from `main`.

4. **Commit** — A commit is a saved snapshot of changes with a message describing what was changed.

5. **Push** — Push uploads my local commits to a remote repository. In this task, I push my feature branch to my fork.

6. **Upstream** — `upstream` refers to the original repository from which my fork was created.

7. **Pull Request** — A pull request is a request to review and potentially merge my changes from my fork into the original repository.

---

## Final Workflow

```text
Fork
  ↓
Clone
  ↓
Add upstream
  ↓
Create feature branch
  ↓
Make changes
  ↓
git add
  ↓
git commit
  ↓
git push
  ↓
Pull Request
  ↓
Mentor Review
  ↓
Possible Merge
```

The main idea I learned from this task is that Git and GitHub are not only about uploading code. They provide a structured way for multiple people to work on the same project while keeping changes isolated, reviewable, and traceable.
