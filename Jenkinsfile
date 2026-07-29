pipeline {
  agent any

  options {
    timestamps()
    ansiColor('xterm')
    buildDiscarder(logRotator(numToKeepStr: '30', artifactNumToKeepStr: '10'))
    timeout(time: 45, unit: 'MINUTES')
    disableConcurrentBuilds()
  }

  environment {
    AWS_REGION      = 'ap-southeast-1'
    AWS_ACCOUNT_ID  = credentials('aws-account-id')
    ECR_REPOSITORY  = 'bachelor-point'
    EKS_CLUSTER     = 'bachelor-point-prod'
    K8S_NAMESPACE   = 'bachelor-point'
    APP_NAME        = 'bachelor-point'
    REGISTRY        = "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"
    IMAGE_REPO      = "${REGISTRY}/${ECR_REPOSITORY}"
    IMAGE_TAG       = "${env.GIT_COMMIT?.take(12) ?: env.BUILD_NUMBER}"
    IMAGE           = "${IMAGE_REPO}:${IMAGE_TAG}"
  }

  stages {

    stage('Checkout') {
      steps {
        checkout scm
        script {
          env.GIT_SHA = sh(returnStdout: true, script: 'git rev-parse --short=12 HEAD').trim()
          env.IMAGE_TAG = env.GIT_SHA
          env.IMAGE = "${env.IMAGE_REPO}:${env.GIT_SHA}"
          currentBuild.displayName = "#${env.BUILD_NUMBER} ${env.GIT_SHA}"
        }
      }
    }

    stage('Install') {
      steps {
        sh 'npm ci'
      }
    }

    stage('Quality gate') {
      parallel {
        stage('Typecheck') {
          steps { sh 'npx prisma generate && npm run typecheck' }
        }
        stage('Lint') {
          steps { sh 'npm run lint' }
        }
        stage('Audit') {
          steps { sh 'npm audit --omit=dev --audit-level=high || true' }
        }
      }
    }

    stage('Build image') {
      steps {
        sh """
          docker build \
            --build-arg BUILDKIT_INLINE_CACHE=1 \
            --cache-from ${IMAGE_REPO}:cache \
            -t ${IMAGE} \
            -t ${IMAGE_REPO}:latest \
            .
        """
      }
    }

    stage('Scan image') {
      steps {
        sh """
          if command -v trivy >/dev/null 2>&1; then
            trivy image --exit-code 1 --severity CRITICAL --ignore-unfixed ${IMAGE}
          else
            echo 'trivy not installed on this agent, skipping image scan'
          fi
        """
      }
    }

    stage('Push to ECR') {
      steps {
        sh """
          aws ecr get-login-password --region ${AWS_REGION} \
            | docker login --username AWS --password-stdin ${REGISTRY}
          docker push ${IMAGE}
          docker push ${IMAGE_REPO}:latest
        """
      }
    }

    stage('Configure kubectl') {
      steps {
        sh "aws eks update-kubeconfig --region ${AWS_REGION} --name ${EKS_CLUSTER}"
        sh "kubectl -n ${K8S_NAMESPACE} get deployments"
      }
    }

    stage('Database migration') {
      steps {
        sh """
          kubectl -n ${K8S_NAMESPACE} delete job ${APP_NAME}-migrate --ignore-not-found=true
          sed 's|REPLACE_IMAGE|${IMAGE}|g' k8s/base/migrate-job.yaml | kubectl apply -f -
          kubectl -n ${K8S_NAMESPACE} wait --for=condition=complete job/${APP_NAME}-migrate --timeout=600s
          kubectl -n ${K8S_NAMESPACE} logs job/${APP_NAME}-migrate
        """
      }
      post {
        failure {
          sh "kubectl -n ${K8S_NAMESPACE} logs job/${APP_NAME}-migrate --tail=200 || true"
        }
      }
    }

    stage('Blue-green deploy') {
      steps {
        sh """
          chmod +x scripts/blue-green.sh
          NAMESPACE=${K8S_NAMESPACE} APP=${APP_NAME} ./scripts/blue-green.sh deploy ${IMAGE}
        """
      }
    }

    stage('Post-switch verification') {
      steps {
        sh """
          NAMESPACE=${K8S_NAMESPACE} APP=${APP_NAME} ./scripts/blue-green.sh status
          kubectl -n ${K8S_NAMESPACE} run verify-${BUILD_NUMBER} --rm -i --restart=Never \
            --image=curlimages/curl:8.10.1 --quiet -- \
            curl -fsS --max-time 10 --retry 3 \
            http://${APP_NAME}-active.${K8S_NAMESPACE}.svc.cluster.local/api/health
        """
      }
    }
  }

  post {
    success {
      echo "Deployed ${IMAGE} to ${EKS_CLUSTER}"
    }
    failure {
      script {
        echo 'Deployment failed. Live traffic was never switched, or is being rolled back.'
        sh """
          chmod +x scripts/blue-green.sh || true
          NAMESPACE=${K8S_NAMESPACE} APP=${APP_NAME} ./scripts/blue-green.sh status || true
        """
      }
    }
    always {
      sh "docker rmi ${IMAGE} ${IMAGE_REPO}:latest || true"
      cleanWs()
    }
  }
}
