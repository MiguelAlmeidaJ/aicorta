"use client";

import { useParams } from "next/navigation";
import { ServiceForm } from "../../../../../../components/services/service-form";

export default function NewServicePage() {
  const { tenantId } = useParams<{ tenantId: string }>();
  return <ServiceForm tenantId={tenantId}/>;
}
