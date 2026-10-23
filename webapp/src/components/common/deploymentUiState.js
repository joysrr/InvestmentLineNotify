export function getDeploymentStatusText(status) {
  return (
    {
      queued: "排隊中...",
      running: "部署執行中...",
      completed: "部署成功完成",
      skipped: "版本已是最新，略過部署",
      failed: "部署失敗",
      cancelled: "已取消",
    }[status] || status
  );
}

export function isDeploymentFinished(status) {
  return ["completed", "skipped", "failed", "cancelled"].includes(status);
}
