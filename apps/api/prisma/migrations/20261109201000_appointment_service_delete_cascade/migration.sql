-- AppointmentService é uma tabela de associação e deve acompanhar a exclusão do serviço.
ALTER TABLE "AppointmentService" DROP CONSTRAINT "AppointmentService_serviceId_fkey";
ALTER TABLE "AppointmentService" ADD CONSTRAINT "AppointmentService_serviceId_fkey"
  FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;
