import { Concept } from "../../models/Concept.js";
import { RecallAttempt } from "../../models/RecallAttempt.js";
import { ReviewState } from "../../models/ReviewState.js";
import { StudySession } from "../../models/StudySession.js";
import { ensureDueRecallAttempts } from "../recall/recallService.js";

function startOfToday(now = new Date()): Date {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfToday(now = new Date()): Date {
  const d = new Date(now);
  d.setHours(23, 59, 59, 999);
  return d;
}

export async function getDashboard(userId: string) {
  await ensureDueRecallAttempts(userId);
  const now = new Date();
  const todayStart = startOfToday(now);
  const todayEnd = endOfToday(now);

  const pendingAttempts = await RecallAttempt.find({ userId, submittedAt: { $exists: false } }).sort({
    createdAt: 1,
  });
  const pendingConceptIds = pendingAttempts.map((a) => a.conceptId);
  const pendingConcepts = await Concept.find({ _id: { $in: pendingConceptIds }, userId });
  const conceptById = new Map(pendingConcepts.map((c) => [String(c._id), c]));
  const reviews = await ReviewState.find({ userId, conceptId: { $in: pendingConceptIds } });
  const reviewByConcept = new Map(reviews.map((r) => [String(r.conceptId), r]));

  const todayDue = pendingAttempts.map((attempt) => {
    const concept = conceptById.get(String(attempt.conceptId));
    const review = reviewByConcept.get(String(attempt.conceptId));
    return {
      recallId: String(attempt._id),
      conceptId: String(attempt.conceptId),
      conceptName: concept?.name ?? "Unknown concept",
      question: attempt.question,
      dueAt: review?.dueAt ?? now,
    };
  });

  const upcomingReviews = await ReviewState.find({ userId,
    dueAt: { $gt: todayEnd },
  })
    .sort({ dueAt: 1 })
    .limit(20);

  const upcomingConcepts = await Concept.find({ userId,
    _id: { $in: upcomingReviews.map((r) => r.conceptId) },
  });
  const upcomingById = new Map(upcomingConcepts.map((c) => [String(c._id), c]));
  const upcoming = upcomingReviews.map((review) => ({
    conceptId: String(review.conceptId),
    conceptName: upcomingById.get(String(review.conceptId))?.name ?? "Unknown concept",
    dueAt: review.dueAt,
    intervalDays: review.intervalDays,
  }));

  const recentSessions = await StudySession.find({ userId })
    .sort({ updatedAt: -1 })
    .limit(8)
    .lean();

  const mastery = await Concept.find({ userId })
    .sort({ mastery: -1, updatedAt: -1 })
    .limit(40)
    .select("name mastery difficulty studySessionId");

  const recallAttemptCount = await RecallAttempt.countDocuments({ userId });
  const submittedCount = await RecallAttempt.countDocuments({ userId,
    submittedAt: { $exists: true },
  });

  return {
    generatedAt: now.toISOString(),
    todayDue,
    upcoming,
    recentlyStudied: recentSessions.map((s) => ({
      id: String(s._id),
      title: s.title,
      status: s.status,
      startedAt: s.startedAt,
      completedAt: s.completedAt,
    })),
    masteryByConcept: mastery.map((c) => ({
      id: String(c._id),
      name: c.name,
      mastery: c.mastery,
      difficulty: c.difficulty,
      studySessionId: String(c.studySessionId),
    })),
    recallAttemptCount,
    submittedRecallCount: submittedCount,
    pendingRecallCount: todayDue.length,
    todayWindow: { start: todayStart, end: todayEnd },
  };
}
