# IT DigiTech Learn

A full-stack Learning Management System (LMS) for delivering structured
online learning experiences. The platform combines a React student
application with a Django REST Framework backend and an administration
console for managing courses, learners, assessments, billing, and
support.

## Overview

IT DigiTech Learn brings core learning and platform operations into one
application, including course content delivery, timed assessments,
subscription payments, student progress, notifications, and support
workflows.

### Key capabilities

-   **Authentication and account security** --- registration, email
    verification, JWT-based authentication, refresh-token handling,
    password recovery, and password-change notifications.
-   **Course catalogue and learning** --- courses organized into modules
    and lessons, with video and note-based lesson content.
-   **Assessments** --- multiple-choice tests, server-side timers,
    answer evaluation, progress tracking, and automatic submission of
    expired attempts.
-   **Subscriptions and payments** --- plan and order workflows with
    Razorpay integration, payment status handling, webhook processing,
    and invoice generation.
-   **Access management** --- enrollment and course-access rules,
    including expiration handling.
-   **Student notifications** --- real-time notifications and support
    updates over WebSockets.
-   **Support centre** --- ticket creation, priority and status
    handling, threaded conversations, attachments, and live replies.
-   **Administration console** --- dashboards and management screens for
    courses, content, tests, users, billing, support tickets,
    announcements, reports, activity, audit logs, email logs, feature
    flags, and platform settings.
-   **Background processing** --- Celery tasks for email delivery,
    report exports, billing reconciliation, assessment maintenance,
    enrollment expiration, and support workflows.
-   **API documentation** --- OpenAPI schema and Swagger UI for
    exploring the API.

## Technology stack

  -----------------------------------------------------------------------
  Area                                Technologies
  ----------------------------------- -----------------------------------
  Frontend                            React 18, Vite, React Router, Axios

  Backend                             Python, Django, Django REST
                                      Framework

  API authentication                  Simple JWT

  Database                            PostgreSQL

  Background jobs                     Celery, Redis

  Real-time communication             Django Channels, WebSockets, Redis
                                      channel layer

  Payments                            Razorpay

  API schema                          drf-spectacular, OpenAPI, Swagger
                                      UI

  Video delivery                      Configurable CDN/token-based video
                                      URL integration

  PDF generation                      ReportLab

  Testing                             pytest, pytest-django, Vitest,
                                      Testing Library

  Local orchestration                 Docker Compose
  -----------------------------------------------------------------------

## Project structure

``` text
itdigitech/
├── backend/
│   ├── apps/
│   │   ├── accounts/        # Authentication and user accounts
│   │   ├── organizations/   # Organization-related models
│   │   ├── catalog/         # Courses, modules, lessons and video access
│   │   ├── billing/         # Plans, orders, payments and invoices
│   │   ├── access/          # Enrollment and access rules
│   │   ├── learning/        # Learning progress
│   │   ├── assessments/     # Tests, attempts and grading
│   │   ├── notifications/   # Notifications, email and exports
│   │   ├── support/         # Support tickets and conversations
│   │   ├── adminpanel/      # Administrative APIs
│   │   └── platform_config/ # Feature flags and platform settings
│   ├── config/              # Django settings, ASGI, URLs and Celery
│   ├── templates/emails/    # HTML email templates
│   ├── tests/
│   ├── .env.example
│   ├── Dockerfile
│   ├── manage.py
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── pages/           # Student-facing pages
│   │   ├── console/         # Administration console
│   │   ├── components/      # Shared UI components
│   │   ├── api/             # API client
│   │   ├── auth/            # Authentication state
│   │   └── realtime/        # WebSocket integration
│   ├── package.json
│   └── vite.config.js
├── docker-compose.yml
└── README.md
```

## Getting started

### Prerequisites

For the Docker-based setup, install:

-   Docker Desktop with Docker Compose
-   Git

For running services directly on your machine, you will also need
Python, Node.js/npm, PostgreSQL, and Redis.

### Option 1: Run with Docker Compose

1.  Clone the repository and enter the project directory:

    ``` bash
    git clone https://github.com/<your-username>/itdigitech-learning-platform.git
    cd itdigitech-learning-platform
    ```

2.  Create your local backend environment file:

    **macOS/Linux**

    ``` bash
    cp backend/.env.example backend/.env
    ```

    **Windows PowerShell**

    ``` powershell
    Copy-Item backend/.env.example backend/.env
    ```

3.  Open `backend/.env` and configure the values for your local
    environment. For payment testing, add your Razorpay **Test Mode**
    credentials. Do not use live keys for local testing.

4.  Build and start the services:

    ``` bash
    docker compose up --build
    ```

5.  In a second terminal, create an administrator account and load demo
    data:

    ``` bash
    docker compose exec backend python manage.py createsuperuser
    docker compose exec backend python manage.py seed_demo
    ```

    The superuser can access the administration console.

### Local URLs

  Service                          URL
  -------------------------------- -------------------------------------
  Student application              http://localhost:5173
  Administration console           http://localhost:5173/console
  Django administration            http://localhost:8000/django-admin/
  API documentation (Swagger UI)   http://localhost:8000/api/docs/
  OpenAPI schema                   http://localhost:8000/api/schema/

The development Vite server proxies `/api`, `/media`, and `/ws` requests
to Django. The Docker Compose configuration sets the proxy target to the
backend container.

## Run without Docker

This mode requires PostgreSQL and Redis running locally.

### 1. Configure the backend

From the repository root:

``` bash
cd backend
```

Create your local environment file by copying `.env.example` to `.env`,
then update the database and Redis settings for services running on your
machine. For example, use `POSTGRES_HOST=localhost` and
`REDIS_URL=redis://localhost:6379/0`.

Create and activate a virtual environment:

**Windows PowerShell**

``` powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

**macOS/Linux**

``` bash
python3 -m venv .venv
source .venv/bin/activate
```

Install dependencies and initialize the database:

``` bash
pip install -r requirements.txt
python manage.py migrate
python manage.py createsuperuser
python manage.py seed_demo
```

Start the ASGI application:

``` bash
uvicorn config.asgi:application --reload
```

### 2. Start Celery

Open separate terminals from the `backend` directory, with the same
environment activated.

Worker:

``` bash
celery -A config worker -l info -Q critical,default,exec,reports
```

Scheduler:

``` bash
celery -A config beat -l info
```

The worker handles queued background tasks; Celery Beat schedules
recurring maintenance jobs.

### 3. Start the frontend

In a new terminal:

``` bash
cd frontend
npm install
npm run dev
```

The frontend is served at http://localhost:5173.

## Environment configuration

The backend reads configuration from environment variables. Start with
`backend/.env.example` and set values appropriate for your environment.

  -----------------------------------------------------------------------
  Variable                            Purpose
  ----------------------------------- -----------------------------------
  `DJANGO_SECRET_KEY`                 Django signing key; use a strong
                                      secret outside local development

  `DJANGO_DEBUG`                      Enables or disables Django debug
                                      mode

  `DJANGO_ALLOWED_HOSTS`              Comma-separated list of allowed
                                      hostnames

  `POSTGRES_DB`                       PostgreSQL database name

  `POSTGRES_USER` /                   Database credentials
  `POSTGRES_PASSWORD`                 

  `POSTGRES_HOST` / `POSTGRES_PORT`   Database connection settings

  `REDIS_URL`                         Redis connection used by cache,
                                      Celery, and Channels

  `RAZORPAY_KEY_ID` /                 Razorpay API credentials
  `RAZORPAY_KEY_SECRET`               

  `RAZORPAY_WEBHOOK_SECRET`           Secret used to verify Razorpay
                                      webhooks

  `CORS_ALLOWED_ORIGINS`              Allowed frontend origins

  `FRONTEND_URL`                      Public frontend URL used in email
                                      links

  `EMAIL_*`                           Email backend and SMTP
                                      configuration

  `VIDEO_CDN_HOST` /                  Video delivery configuration
  `VIDEO_TOKEN_KEY`                   
  -----------------------------------------------------------------------

For local development, the configured email backend prints email
messages to the console. To deliver real emails, configure an SMTP
provider and set `EMAIL_BACKEND` and the corresponding `EMAIL_*`
variables.

**Never commit `backend/.env`, live payment credentials, production
secrets, private media, or real user/payment data.** The repository
includes `.env.example` as a template.

## Razorpay test setup

1.  Enable **Test Mode** in your Razorpay Dashboard.
2.  Create or retrieve test API credentials and set `RAZORPAY_KEY_ID`
    and `RAZORPAY_KEY_SECRET` in `backend/.env`.
3.  Configure a webhook endpoint for your reachable backend:
    `https://<your-public-host>/api/v1/billing/webhooks/razorpay`
4.  Subscribe to the payment events required by the application,
    including `payment.captured`, `payment.failed`, and `order.paid`,
    and set the matching webhook secret in `RAZORPAY_WEBHOOK_SECRET`.
5.  For local webhook testing, expose your development server using a
    secure tunnelling tool and configure that public URL in Razorpay.

Use Razorpay's official test payment details and test flows. Do not use
live credentials for development or publish credentials in the
repository.

## API and real-time communication

-   REST API routes are grouped under `/api/v1/`.
-   Swagger UI is available at `/api/docs/`.
-   The OpenAPI schema is available at `/api/schema/`.
-   WebSocket routes are configured through Django Channels and the ASGI
    application.
-   In local development, Vite proxies API and WebSocket traffic to the
    backend.

For endpoint details, authentication requirements, request schemas, and
response formats, use the generated API documentation while the backend
is running.

## Testing

### Backend

From `backend/`:

``` bash
pytest
```

The test configuration is designed to run the backend test suite with
test-specific settings. Check the test configuration if you change
database or service dependencies.

### Frontend

From `frontend/`:

``` bash
npm test
```

Create a production frontend build with:

``` bash
npm run build
```

## Production considerations

Before deploying, review and configure all of the following:

-   Use a strong `DJANGO_SECRET_KEY`, set `DJANGO_DEBUG=0`, and
    configure `DJANGO_ALLOWED_HOSTS`.
-   Use production database credentials and a managed or secured Redis
    deployment.
-   Configure HTTPS, trusted origins, CORS, and secure cookies for the
    deployed domains.
-   Set production Razorpay credentials only after completing test-mode
    validation, and configure webhook signatures and delivery.
-   Configure real SMTP/email delivery and set `FRONTEND_URL` to the
    public frontend domain.
-   Configure production video CDN credentials and persistent
    media/object storage.
-   Serve Django through an appropriate production ASGI/WSGI deployment
    and reverse proxy.
-   Run Celery workers and Celery Beat as managed processes; monitor
    queue health, retries, and failures.
-   Collect static files and configure static/media delivery for the
    deployment environment.
-   Keep secrets and personal data out of Git history, logs,
    screenshots, and demo fixtures.

The included Docker Compose setup is intended for local development, not
as a complete production deployment configuration.

## Project status

The repository implements the learning, assessment, billing,
notification, support, and administration workflows described above.
Features such as a code lab, project workspace, interview preparation,
AI assistant, certificates, and a college-specific panel are future
enhancements and are not represented as currently available
functionality.

## License

No license is specified in this repository yet. Add a `LICENSE` file
before presenting the project as open source, and choose a license that
matches how you want others to use the code.
