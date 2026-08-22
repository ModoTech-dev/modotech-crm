from django.urls import path
from .views import AgentPerformanceView, DashboardStatsView

urlpatterns = [
    path("dashboard/", DashboardStatsView.as_view(), name="report-dashboard"),
    path("agent-performance/", AgentPerformanceView.as_view(), name="report-agent-performance"),
]
