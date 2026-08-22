#!/bin/bash
# Checks container health every few minutes and emails an alert if
# anything's down — checking each service the app actually needs, not
# just "is Docker running" generically. Avoids repeat spam by only
# alerting once per outage (tracked via a state file on disk), and
# sends a follow-up "recovered" email once things are healthy again,
# so an incident's actual end is visible too, not just its start.
#
# Credentials live in ~/.email_credentials — deliberately OUTSIDE the
# git-tracked project folder entirely, so there's no chance of them
# ever ending up in version control or on GitHub, even by accident.

cd "$(dirname "$0")"
STATE_FILE="$HOME/.healthcheck_alerted"
CRED_FILE="$HOME/.email_credentials"
LOG_FILE="$HOME/healthcheck.log"

if [ ! -f "$CRED_FILE" ]; then
    echo "$(date): ERROR - $CRED_FILE not found, cannot send alerts" >> "$LOG_FILE"
    exit 1
fi
source "$CRED_FILE"  # expects EMAIL_ADDRESS and EMAIL_PASSWORD to be set

DOWN_SERVICES=""
for svc in backend celery_worker celery_beat frontend nginx postgres redis; do
    STATUS=$(docker compose ps --format json "$svc" 2>/dev/null | grep -o '"State":"[^"]*"' | cut -d'"' -f4)
    if [ "$STATUS" != "running" ]; then
        DOWN_SERVICES="$DOWN_SERVICES $svc(${STATUS:-not_found})"
    fi
done

send_email() {
    local subject="$1"
    local body="$2"
    {
        echo "From: $EMAIL_ADDRESS"
        echo "To: $EMAIL_ADDRESS"
        echo "Subject: $subject"
        echo ""
        echo "$body"
    } > /tmp/healthcheck_email.txt

    curl -s --url "smtps://smtp.hostinger.com:465" \
        --ssl-reqd \
        --mail-from "$EMAIL_ADDRESS" \
        --mail-rcpt "$EMAIL_ADDRESS" \
        --upload-file /tmp/healthcheck_email.txt \
        --user "$EMAIL_ADDRESS:$EMAIL_PASSWORD"
    rm -f /tmp/healthcheck_email.txt
}

if [ -n "$DOWN_SERVICES" ]; then
    if [ ! -f "$STATE_FILE" ]; then
        send_email "ALERT: Modotech CRM - service down" "The following services are not running:$DOWN_SERVICES

Check: docker compose ps
Logs: docker compose logs <service> --tail=50

(You won't get another alert for this same outage until it's resolved — this avoids spamming you every few minutes for one ongoing issue.)"
        touch "$STATE_FILE"
        echo "$(date): Alert sent - down:$DOWN_SERVICES" >> "$LOG_FILE"
    fi
else
    if [ -f "$STATE_FILE" ]; then
        send_email "RESOLVED: Modotech CRM - all services recovered" "All services are back to running normally."
        rm -f "$STATE_FILE"
        echo "$(date): Recovery notified" >> "$LOG_FILE"
    fi
fi
