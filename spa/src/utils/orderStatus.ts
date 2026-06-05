export const ORDER_STATUS_STEPS: Record<string, { label: string; description: string }> = {
  awaiting_photo: {
    label: "Awaiting photo",
    description: "We’re waiting for your pet photo to kick things off.",
  },
  pending_review: {
    label: "Photo submitted",
    description: "Our team is verifying the photo quality before production.",
  },
  in_production: {
    label: "In production",
    description: "Artists are crafting each portrait style you selected.",
  },
  qa_review: {
    label: "Quality review",
    description: "We’re doing a final polish to make sure every detail shines.",
  },
  delivered: {
    label: "Delivered",
    description: "Your portraits are ready! Check your inbox for download links.",
  },
};

export function getStatusLabel(status: string | null | undefined): string {
  if (!status) return "";
  return ORDER_STATUS_STEPS[status]?.label ?? status;
}

export function getStatusDescription(status: string | null | undefined): string {
  if (!status) return "";
  return ORDER_STATUS_STEPS[status]?.description ?? "";
}
