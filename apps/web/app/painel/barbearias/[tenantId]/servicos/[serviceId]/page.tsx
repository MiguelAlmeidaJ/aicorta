"use client";

import { useParams } from "next/navigation";
import { ServiceForm } from "../../../../../../components/services/service-form";

export default function EditServicePage() {
  const { tenantId, serviceId } = useParams<{ tenantId: string; serviceId: string }>();
  return <ServiceForm tenantId={tenantId} serviceId={serviceId}/>;
}
