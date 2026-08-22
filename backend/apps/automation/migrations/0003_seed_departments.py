from django.db import migrations

DEPARTMENTS = [
    ("Sales", "SALES"),
    ("Finance", "FINANCE"),
    ("Technical", "TECHNICAL"),
    ("General", "GENERAL"),  # fallback bucket for anything routing doesn't match
]


def seed_departments(apps, schema_editor):
    Department = apps.get_model("automation", "Department")
    for name, code in DEPARTMENTS:
        Department.objects.get_or_create(code=code, defaults={"name": name})


def unseed_departments(apps, schema_editor):
    Department = apps.get_model("automation", "Department")
    Department.objects.filter(code__in=[code for _, code in DEPARTMENTS]).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("automation", "0002_department"),
    ]

    operations = [
        migrations.RunPython(seed_departments, unseed_departments),
    ]
