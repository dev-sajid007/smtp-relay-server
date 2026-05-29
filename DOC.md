# SMTP Relay Provider MVP v1

## Project Overview

একটি self-hosted Email Relay Provider যা SMTP credentials ব্যবহার করে email গ্রহণ করবে, queue করবে, DKIM sign করবে এবং Postfix এর মাধ্যমে recipient server-এ deliver করবে।

Target:

* Single Admin User
* Single VPS
* Single PostgreSQL Database
* Multiple Domains
* SMTP Authentication
* Email Queue
* Email Logs

---

# Technology Stack

## Backend

* Node.js 24+
* NestJS
* Fastify
* Prisma ORM
* PostgreSQL
* Redis
* BullMQ

## Mail Services

* Postfix
* OpenDKIM

## Frontend

* React
* Vite
* Tailwind CSS
* Shadcn UI

---

# Monorepo Structure

email-relay/

apps/

api/

smtp-server/

worker/

admin-panel/

packages/

database/

shared/

auth/

logger/

mailer/

infra/

docker/

postgres/

redis/

postfix/

dkim/

---

# Features

## Authentication

Admin Login

JWT Authentication

Password Hashing

Session Management

---

## Domain Management

Add Domain

Delete Domain

Verify Domain

Show DNS Records

Generate DKIM Key

Required DNS:

SPF

DKIM

DMARC

---

## SMTP Credentials

Generate Username

Generate Password

Enable Credential

Disable Credential

Rotate Password

---

## Send Email

SMTP Authentication

MAIL FROM

RCPT TO

DATA

Message Validation

Store Email Record

Queue Message

---

## Email Queue

BullMQ

Redis Queue

Retry Failed Messages

Delayed Sending

Status Tracking

Statuses:

Queued

Processing

Sent

Failed

---

## Email Logs

Message ID

Sender

Recipient

Subject

Status

Created At

Delivered At

Failure Reason

---

## DKIM Signing

Generate DKIM Keys

Store Private Key

Display DNS Record

Sign Outgoing Emails

---

# Database Schema

## admins

id

email

password

created_at

updated_at

---

## domains

id

name

verified

dkim_selector

dkim_private_key

dkim_public_key

created_at

updated_at

---

## smtp_credentials

id

username

password_hash

active

created_at

updated_at

---

## emails

id

message_id

from_email

to_email

subject

body

status

failure_reason

created_at

updated_at

---

## email_events

id

email_id

event

metadata

created_at

---

# SMTP Flow

SMTP Client

↓

SMTP Server

↓

Authentication

↓

Database Save

↓

Queue

↓

Worker

↓

DKIM Sign

↓

Postfix

↓

Recipient Server

---

# API Modules

Auth Module

Domain Module

SMTP Module

Email Module

Queue Module

Log Module

DKIM Module

Health Module

---

# Dashboard Pages

Login

Dashboard

Domains

SMTP Credentials

Email Logs

Settings

---

# Environment Variables

DATABASE_URL

REDIS_URL

JWT_SECRET

SMTP_HOST

SMTP_PORT

SMTP_USERNAME

SMTP_PASSWORD

DKIM_SELECTOR

DKIM_PRIVATE_KEY

POSTFIX_HOST

POSTFIX_PORT

---

# VPS Requirements

Ubuntu 24.04

2 vCPU

4 GB RAM

50 GB SSD

Port 25 Open

PTR Record Enabled

---

# MVP Goals

Admin Login

Domain Management

SMTP Credential Management

Email Sending

Queue Processing

Email Logging

DKIM Signing

No Multi-user Support

No Billing

No Open Tracking

No Click Tracking

No Dedicated IP Pools

---

# Future Versions

v2

Open Tracking

Click Tracking

Bounce Processing

Webhook Support

REST Email API

v3

Multi User

Billing

Subscription Plans

Dedicated IPs

IP Pools

Warmup System

Analytics
