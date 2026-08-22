from rest_framework.routers import DefaultRouter
from .views import DepartmentViewSet, RoutingRuleViewSet

router = DefaultRouter()
router.register("routing-rules", RoutingRuleViewSet, basename="routing-rule")
router.register("departments", DepartmentViewSet, basename="department")

urlpatterns = router.urls
