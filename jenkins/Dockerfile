FROM jenkins/jenkins:2.479.1-lts-jdk17

USER root

RUN apt-get update && apt-get install -y --no-install-recommends \
      curl ca-certificates gnupg openssh-client git rsync jq \
  && rm -rf /var/lib/apt/lists/*

RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
  && apt-get install -y nodejs \
  && rm -rf /var/lib/apt/lists/*

RUN curl -fsSLo /usr/local/bin/kubectl \
      "https://dl.k8s.io/release/$(curl -Ls https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl" \
  && chmod +x /usr/local/bin/kubectl

COPY plugins.txt /usr/share/jenkins/ref/plugins.txt
RUN jenkins-plugin-cli --plugin-file /usr/share/jenkins/ref/plugins.txt

ENV JAVA_OPTS="-Djenkins.install.runSetupWizard=false -Dhudson.model.DownloadService.noSignatureCheck=true"
ENV CASC_JENKINS_CONFIG=/var/jenkins_conf/jenkins.yaml

USER jenkins
