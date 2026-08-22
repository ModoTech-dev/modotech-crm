"""
ISP billing/customer-management integration abstraction.

The CRM never talks to Modotech's ISP system directly — everywhere the
CRM needs ISP data it calls get_isp_service(), which returns whichever
class ISP_SERVICE_CLASS points to. Swap MockISPService for a real
implementation later without touching any view or serializer.
"""
from __future__ import annotations

import abc
from dataclasses import dataclass, asdict
from datetime import date, timedelta
from django.utils.module_loading import import_string


@dataclass
class ISPAccount:
    account_number: str
    package: str
    speed_mbps: int
    monthly_price: float
    status: str  # ACTIVE | SUSPENDED | INACTIVE
    balance: float
    last_payment_date: date | None
    next_expiry_date: date | None
    installation_date: date | None
    service_location: str

    def to_dict(self):
        return asdict(self)


class ISPService(abc.ABC):
    @abc.abstractmethod
    def get_customer(self, isp_customer_id: str) -> ISPAccount | None: ...

    @abc.abstractmethod
    def get_account_status(self, isp_customer_id: str) -> str: ...

    @abc.abstractmethod
    def get_balance(self, isp_customer_id: str) -> float: ...

    @abc.abstractmethod
    def get_package(self, isp_customer_id: str) -> str: ...

    @abc.abstractmethod
    def get_payment_history(self, isp_customer_id: str) -> list[dict]: ...

    @abc.abstractmethod
    def suspend_customer(self, isp_customer_id: str, reason: str = "") -> bool: ...

    @abc.abstractmethod
    def activate_customer(self, isp_customer_id: str) -> bool: ...


class MockISPService(ISPService):
    """Deterministic fake data so the frontend/API can be built against
    a stable contract before the real billing system is connected."""

    def get_customer(self, isp_customer_id: str) -> ISPAccount | None:
        if not isp_customer_id:
            return None
        return ISPAccount(
            account_number=isp_customer_id,
            package="Fiber 20 Mbps",
            speed_mbps=20,
            monthly_price=2500.0,
            status="ACTIVE",
            balance=0.0,
            last_payment_date=date.today() - timedelta(days=12),
            next_expiry_date=date.today() + timedelta(days=18),
            installation_date=date.today() - timedelta(days=200),
            service_location="Nairobi, Kenya",
        )

    def get_account_status(self, isp_customer_id: str) -> str:
        account = self.get_customer(isp_customer_id)
        return account.status if account else "UNKNOWN"

    def get_balance(self, isp_customer_id: str) -> float:
        account = self.get_customer(isp_customer_id)
        return account.balance if account else 0.0

    def get_package(self, isp_customer_id: str) -> str:
        account = self.get_customer(isp_customer_id)
        return account.package if account else ""

    def get_payment_history(self, isp_customer_id: str) -> list[dict]:
        return [
            {"date": str(date.today() - timedelta(days=12)), "amount": 2500.0, "method": "M-Pesa"},
            {"date": str(date.today() - timedelta(days=42)), "amount": 2500.0, "method": "M-Pesa"},
        ]

    def suspend_customer(self, isp_customer_id: str, reason: str = "") -> bool:
        return True

    def activate_customer(self, isp_customer_id: str) -> bool:
        return True


def get_isp_service() -> ISPService:
    from django.conf import settings

    service_class = import_string(settings.ISP_SERVICE_CLASS)
    return service_class()
