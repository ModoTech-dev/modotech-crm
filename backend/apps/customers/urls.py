from rest_framework.routers import DefaultRouter
from .views import CustomerViewSet, TagViewSet

router = DefaultRouter()
router.register("customers", CustomerViewSet, basename="customer")
router.register("tags", TagViewSet, basename="tag")

urlpatterns = router.urls
