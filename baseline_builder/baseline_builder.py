import json
import sys
import os
import datetime
import argparse
from git import Repo, GitCommandError
import docker
import requests
import re
from subprocess import call


def retrieve_pr(repository_name, pr):
    github_api_token = os.environ["GITHUB_API_TOKEN"]
    r = requests.get("https://api.github.com/repos/" + repository_name + "/pulls/" + pr, headers={
                     'Authorization': 'token ' + github_api_token, 'User-Agent': 'dojot-baseline-builder'})
    if "body" in r.json():
        pr_comment = r.json()["body"]
        title = r.json()["title"]
        reg = re.compile("(dojot\/dojot#.[0-9]+)")
        ret = reg.findall(pr_comment)
        return [title, ret]
    else:
        return ["PR not found", "none"]


def get_repository_id(repository_name, owner="dojot"):
    github_api_token = os.environ["GITHUB_API_TOKEN"]

    print("Getting Repository id for "+owner+"/"+repository_name)

    requestRepoId = {
        "query": "query ($owner: String!, $repoName: String!) {repository(owner: $owner, name: $repoName) {id}}",
        "variables": {"owner": "dojot", "repoName": "undefinied"}
    }
    requestRepoId['variables']['owner'] = owner
    requestRepoId['variables']['repoName'] = repository_name

    r = requests.post("https://api.github.com/graphql", json=requestRepoId, headers={
        'Authorization': 'bearer ' + github_api_token, 'Content-Type': 'application/json'})
    if "data" in r.json():
        return r.json()["data"]["repository"]["id"]
    else:
        print("Cant get repositoryId from "+repository_name)
        return ''


def create_pr(repoId, repository_name, branchTo="master", branchFrom="development", titlePR="new PR"):
    github_api_token = os.environ["GITHUB_API_TOKEN"]

    requestCreatePR = {
        "query": "mutation ($branchTo: String!, $titlePR: String!, $branchFrom: String!, $repoId: ID!) { createPullRequest(input: {baseRefName: $branchTo, title: $titlePR, repositoryId: $repoId, headRefName: $branchFrom, maintainerCanModify: true}) { pullRequest { title id } }}",
        "variables": {
            "branchTo": "",
            "titlePR": "",
            "branchFrom": "",
            "repoId": ""
        }
    }
    requestCreatePR['variables']['branchTo'] = branchTo
    requestCreatePR['variables']['titlePR'] = titlePR
    requestCreatePR['variables']['branchFrom'] = branchFrom
    requestCreatePR['variables']['repoId'] = repoId

    print("Creating PR for " + repository_name +
          "from " + branchFrom + " to " + branchTo)

    r = requests.post("https://api.github.com/graphql", json=requestCreatePR, headers={
        'Authorization': 'bearer ' + github_api_token, 'Content-Type': 'application/json'})

    if "errors" in r.json():
        print("Cant create PR branchTo:"+branchTo+" branchFrom:" +
              branchFrom + " repository:"+repository_name)
        print(r.json())


def create_prs(spec, selected_repo, branch_from, branch_to):

    for repo_config in spec["components"]:
        repository_name = repo_config['repository-name']
        github_repository = repo_config['github-repository']

        print("Create PR for "+repository_name)

        if selected_repo != "all" and repository_name != selected_repo:
            print("Skipping " + repository_name + " from merging.")
            continue

        repo_info = github_repository.split("/")
        owner = repo_info[0]
        repository_name = repo_info[1]
        repoID = get_repository_id(repository_name, owner)

        title_pr = "Merge baseline "+spec['tag']

        create_pr(repoID, repository_name, branch_to, branch_from, title_pr)


def build_backlog_message(repo, repository_name, last_commit, current_commit):
    offset = 0
    commit_it = list(repo.iter_commits(
        current_commit, max_count=1, skip=offset))[0]
    messages = []
    message = ""
    print("Building backlog messages for repository " + repository_name)
    while commit_it.hexsha != last_commit:
        commit_it = list(repo.iter_commits(
            current_commit, max_count=1, skip=offset))[0]
        if commit_it.hexsha == last_commit:
            break
        searchObj = re.match(
            "Merge pull request #(.*) from .*", commit_it.message)
        if searchObj:
            pr = searchObj.group(1)
            message = repository_name + "#" + pr
            print("Retrieving information for PR " + message)
            title, issues = retrieve_pr(repository_name, pr)
            if issues:
                message += ", fixing"
                for issue in issues:
                    message += " " + issue
            message += ": " + title
            messages.append(message)
        offset = offset + 1
    if messages:
        message = repository_name + "\n"
        for _c in repository_name:
            message += "-"
        message += "\n\n"
        for m in messages:
            message += m + "\n"
    return message


def build_backlog_messages(spec, selected_repo):
    message = ""
    for repo_config in spec["components"]:
        repository_name = repo_config['repository-name']
        github_repository = repo_config['github-repository']

        if selected_repo != "all" and repository_name != selected_repo:
            print("Skipping " + repository_name + " from merging.")
            continue

        last_commit = repo_config["last-commit"]
        current_commit = repo_config["current-commit"]
        repository_dest = "./git_repos/"+repository_name
        repo = Repo(repository_dest)
        repo_message = build_backlog_message(
            repo, github_repository, last_commit, current_commit)
        if repo_message:
            repo_message += "\n\n"
        message += repo_message
    print("Backlog is:\n\n")
    print(message)


def checkout_git_repositories(spec, selected_repo):
    print("Checking out repositories...")
    username = os.environ["GITHUB_USERNAME"]
    usertoken = os.environ["GITHUB_TOKEN"]
    branch_name = "release/"+spec['tag']
    github_preamble = "https://" + username + ":" + usertoken + "@github.com/"
    print("Creating output directory...")
    try:
        os.stat("./git_repos")
    except:
        os.mkdir("./git_repos")
    print("... output repository directory created.")

    for repo_config in spec["components"]:
        repository_name = repo_config['repository-name']

        if selected_repo != "all" and repository_name != selected_repo:
            print("Skipping " + repository_name + " from checkout.")
            continue

        repository_url = github_preamble + repo_config['github-repository']
        repository_dest = "./git_repos/"+repo_config['repository-name']
        commit_id = repo_config['current-commit']

        print("Checking out " + repository_name)
        print("From GitHub repository " + repo_config['github-repository'])
        print("At commit " + commit_id)

        print("Cloning repository...")
        repo = Repo.clone_from(repository_url, repository_dest)
        print("... repository was cloned")

        print("Creating branch " + branch_name + " ...")
        repo.head.reference = repo.create_head(branch_name, commit_id)
        repo.head.reset(index=True, working_tree=True)
        print("... '"+branch_name+"' branch was created")
    print("... repositories were checked out.")


def create_git_tag(spec, selected_repo):
    print("Creating tag for all repositories...")
    baseline_tag_name = spec["tag"]
    branch_name = "release/"+spec['tag']
    for repo_config in spec["components"]:
        repository_name = repo_config['repository-name']

        if selected_repo != "all" and repository_name != selected_repo:
            print("Skipping " + repository_name + " from creating tag.")
            continue

        repository_dest = "./git_repos/"+repo_config['repository-name']
        repo = Repo(repository_dest)
        baseline_head = repo.heads[branch_name]

        print("Creating tag "+baseline_tag_name +
              " for repository " + repository_name + "...")
        print("Checking whether tag has already been created...")

        if (baseline_tag_name in repo.tags):
            print("... tag has been already created.")
            print("... skipping repository " + repository_name + ".")
            continue
        else:
            print("... tag is not created yet. Good to go.")

        print("Creating baseline tag...")
        repo.create_tag(baseline_tag_name, ref=baseline_head,
                        message="Baseline: " + baseline_tag_name)
        print("... baseline tag was created.")
        print("... repository " + repository_name +
              " was properly tagged.")
    print("... all repositories were tagged.")


def push_git_tag(spec, selected_repo):
    print("Pushing everything to GitHub...")
    baseline_tag_name = spec["tag"]
    for repo_config in spec["components"]:
        repository_name = repo_config['repository-name']

        if selected_repo != "all" and repository_name != selected_repo:
            print("Skipping " + repository_name + " from pushing tag.")
            continue

        repository_dest = "./git_repos/"+repo_config['repository-name']
        repo = Repo(repository_dest)
        print("Pushing tag to repository " + repository_name + "...")

        print("Pushing baseline tag...")
        baseline_tag = repo.tags[baseline_tag_name]
        repo.remotes.origin.push(baseline_tag)
        print("... baseline tag was pushed.")

        print("... all changes were pushed to " + repository_name + ".")
    print("... everything was pushed to GitHub.")


def push_git_branchs(spec, selected_repo):
    print("Pushing branchs to GitHub...")
    baseline_branch_name = "release/"+spec["tag"]
    for repo_config in spec["components"]:
        repository_name = repo_config['repository-name']

        if selected_repo != "all" and repository_name != selected_repo:
            print("Skipping " + repository_name + " from pushing branch.")
            continue

        repository_dest = "./git_repos/"+repo_config['repository-name']
        repo = Repo(repository_dest)
        print("Pushing branch "+baseline_branch_name +
              " to repository " + repository_name + "...")

        repo.remotes.origin.push(baseline_branch_name)
        print("... branch was pushed.")

        print("... all changes were pushed to " + repository_name + ".")
    print("... everything was pushed to GitHub.")


def build_docker_baseline(spec, selected_repo):
    for repo_config in spec["components"]:
        repository_name = repo_config['repository-name']

        if selected_repo != "all" and repository_name != selected_repo:
            print("Skipping " + repository_name +
                  " from pushing Docker images.")
            continue

        if not "docker-hub-repositories" in repo_config:
            print("No image to generate in " + repository_name)
            continue

        for docker_repo in repo_config["docker-hub-repositories"]:
            docker_name = docker_repo["name"]
            dockerfile = docker_repo["dockerfile"]
            baseline_tag_name = spec["tag"]
            repository_dest = "./git_repos/"+repo_config['repository-name']

            print("Building image for " + docker_name)
            os.system("docker build -t " + docker_name + ":" + baseline_tag_name +
                      " --no-cache -f " + repository_dest + "/" + dockerfile + " " + repository_dest)


def tag_docker_baseline(spec, selected_repo):
    client = docker.from_env()
    docker_username = os.environ["DOCKER_USERNAME"]
    docker_password = os.environ["DOCKER_TOKEN"]
    print("Logging into Docker Hub...")
    client.login(docker_username, docker_password)
    print("... logged in.")
    for repo_config in spec["components"]:
        repository_name = repo_config['repository-name']

        if selected_repo != "all" and repository_name != selected_repo:
            print("Skipping " + repository_name +
                  " from pushing Docker images.")
            continue

        if not "docker-hub-repositories" in repo_config:
            print("No image to pushing in " + repository_name)
            continue

        for docker_repo in repo_config["docker-hub-repositories"]:
            docker_name = docker_repo["name"]
            baseline_tag_name = spec["tag"]

            print("Pushing new tag... " + docker_name + ":" + baseline_tag_name)
            client.images.push(docker_name + ":" + baseline_tag_name)
            print("... pushed.")


def remove_docker_tags(spec, selected_repo):

    print("Logging into Docker Hub...")
    login_data = requests.post('https://hub.docker.com/v2/users/login/',
                               json={"username": os.environ["DOCKER_USERNAME"],
                                     "password": os.environ["DOCKER_TOKEN"]})

    token = login_data.json().get('token')
    print("... logged in.")

    for repo_config in spec["components"]:
        repository_name = repo_config['repository-name']

        if selected_repo != "all" and repository_name != selected_repo:
            print("Skipping " + repository_name +
                  " from untagging Docker images.")
            continue

        if not "docker-hub-repositories" in repo_config:
            print("No image to generate in " + repository_name)
            continue

        for docker_repo in repo_config["docker-hub-repositories"]:
            organization_name, image_name = docker_repo["name"].split("/")
            tag_name = spec["tag"]

            print("Removing tag...")

            url = "https://hub.docker.com/v2/repositories/{}/{}/tags/{}/".format(
                organization_name, image_name, tag_name)

            requests.delete(url, headers={"Authorization": "JWT " + token})

            print("... removed.")


def main():
    print("Starting baseline builder...")

    failed = False
    if "GITHUB_USERNAME" not in os.environ:
        print("GITHUB_USERNAME variable is missing.")
        failed = True
    if "GITHUB_TOKEN" not in os.environ:
        print("GITHUB_TOKEN variable is missing.")
        failed = True
    if "GITHUB_API_TOKEN" not in os.environ:
        print("GITHUB_API_TOKEN variable is missing.")
        failed = True
    if "DOCKER_USERNAME" not in os.environ:
        print("DOCKER_USERNAME variable is missing.")
        failed = True
    if "DOCKER_TOKEN" not in os.environ:
        print("DOCKER_TOKEN variable is missing.")
        failed = True
    if failed:
        exit(1)

    parser = argparse.ArgumentParser(
        description='Parameters fot the dojot building process.')

    parser.add_argument('--repository', '-r', dest='selected_repo', default='all',
                        type=str, help='defines which repository will be handled, default to: all')
    parser.add_argument('--type', '-t', dest='build_type', default='baseline', choices=['baseline', 'nightly'],
                        type=str, help='Sets the type of build that will be executed, the value can be either baseline or nightly')
    parser.add_argument('--command', '-c', dest='command', default='checkout',
                        choices=['checkout', 'build', 'push',
                                 'backlog', 'cleanup', 'create-branch', 'create-tags', 'create-prs'],
                        type=str, help='Sets the type of build that will be executed, the value can be either baseline or nightly')
    parser.add_argument('--age', default=15, type=int,
                        help='Age of the containers that will be removed from docker hub')
    parser.add_argument('--branchfrom', dest='branch_from', default='development', type=str,
                        help='Branch from to create o PR, only for create-prs')
    parser.add_argument('--branchto', dest='branch_to', default='master', type=str,
                        help='Branch destination to create o PR, only for create-prs')

    args = parser.parse_args()

    print("Reading baseline spec file...")

    if args.build_type in "baseline":
        raw_spec = open("baseline-spec.json", "r")
    elif args.build_type in "nightly":
        raw_spec = open("nightly-spec.json", "r")
    else:
        print("Invalid build type, expected 'nightly' or 'baseline'")
        exit(1)

    # Treat exceptions
    spec = json.loads(raw_spec.read())

    # If nightly build, set the date dinamically
    if args.build_type in "nightly":
        if args.command in "cleanup":
            old_date = datetime.datetime.now().toordinal() - args.age
            spec['tag'] = spec['tag'] + \
                datetime.datetime.fromordinal(old_date).strftime("%Y%m%d")
        else:
            spec['tag'] = spec['tag'] + \
                datetime.datetime.now().strftime("%Y%m%d")

    if args.command in "checkout":
        checkout_git_repositories(spec, args.selected_repo)
    elif args.command in "build":
        build_docker_baseline(spec, args.selected_repo)
    elif args.command in "create-branchs":
        push_git_branchs(spec, args.selected_repo)
    elif args.command in "push":
        tag_docker_baseline(spec, args.selected_repo)
    elif args.command in "backlog":
        build_backlog_messages(spec, args.selected_repo)
    elif args.command in "cleanup":
        remove_docker_tags(spec, args.selected_repo)
    elif args.command in "create-tags":
        create_git_tag(spec, args.selected_repo)
        push_git_tag(spec, args.selected_repo)
    elif args.command in "create-prs":
        create_prs(spec, args.selected_repo, args.branch_from, args.branch_to)

    else:
        print("Invalid command selected: " + args.command)
        exit(1)


if __name__ == "__main__":
    main()
