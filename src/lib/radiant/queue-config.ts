import type { CreativeFormat, CreativeJob } from "@/lib/radiant/types";

/** V1 hackathon: queue only surfaces image + video jobs for media verification. */
export const QUEUE_MEDIA_FORMATS: CreativeFormat[] = ["image_ad", "video_prompt"];

export function isMediaQueueJob(job: CreativeJob): boolean {
  return job.format === "image_ad" || job.format === "video_prompt";
}

export function filterMediaQueueJobs(jobs: CreativeJob[]): CreativeJob[] {
  return jobs.filter(isMediaQueueJob);
}
