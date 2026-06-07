/* ── API Response Wrapper ──────────────────────────── */
export interface ApiResponse<T = unknown> {
  data: T;
  message: string;
}

export interface ApiError {
  detail: string;
}

/* ── Chat ─────────────────────────────────────────── */
export type ChatRole = 'user' | 'assistant';

export interface ChatMessage {
  role: ChatRole;
  content: string;
  created_at: string;
}

export interface ChatSendResponse {
  reply: string;
  created_at: string;
}

/* ── Auth ──────────────────────────────────────────── */
export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterStudentRequest {
  email: string;
  password: string;
  full_name: string;
  phone?: string;
  address?: string;
  birth_year?: number;
}

export interface RegisterTutorRequest {
  email: string;
  password: string;
  full_name: string;
  phone?: string;
  address?: string;
  birth_year?: number;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
}

export type UserRole = 'SUPER_ADMIN' | 'STAFF' | 'TUTOR' | 'STUDENT';
export type UserStatus = 'ACTIVE' | 'SUSPENDED';

export interface UserResponse {
  id: number;
  email: string;
  role: UserRole;
  full_name: string;
  phone: string | null;
  address: string | null;
  birth_year: number | null;
  avatar_url: string | null;
  status: UserStatus;
}

export interface TutorProfileBrief {
  id: number;
  verification_status: TutorVerificationStatus;
  teaching_mode: TeachingMode;
  teaching_area: string | null;
}

export interface MeResponse {
  user: UserResponse;
  tutor_profile: TutorProfileBrief | null;
}

export interface AdminStaffResponse {
  id: number;
  email: string;
  full_name: string;
  phone: string | null;
  avatar_url: string | null;
  status: UserStatus;
  created_at: string | null;
  updated_at: string | null;
}

export interface AdminStaffCreate {
  email: string;
  full_name: string;
  password?: string;
  phone?: string;
}

export interface AdminStaffCreateResponse {
  staff: AdminStaffResponse;
  temp_password: string;
}

export interface AdminStatsResponse {
  users_by_role: Partial<Record<UserRole, number>>;
  total_users: number;
  active_staff: number;
  suspended_staff: number;
  classes_by_status: Record<string, number>;
  paid_revenue: number;
  pending_tutors: number;
  payment_queue: number;
  pending_contracts: number;
  audit_log_count: number;
}

export interface AuditLogResponse {
  id: number;
  actor_id: number | null;
  actor_name: string | null;
  actor_email: string | null;
  action: string;
  target_type: string;
  target_id: number | null;
  detail: Record<string, unknown>;
  created_at: string | null;
}

/* ── Tutor ─────────────────────────────────────────── */
export type TutorVerificationStatus = 'DRAFT' | 'PENDING_REVIEW' | 'VERIFIED' | 'REJECTED';
export type TeachingMode = 'ONLINE' | 'OFFLINE' | 'BOTH';
export type QualificationStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type TutorSubjectStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface TutorProfileUpdate {
  bio?: string;
  qualification_level?: string;
  years_experience?: number;
  teaching_mode?: TeachingMode;
  teaching_area?: string;
}

export interface TutorProfileResponse {
  id: number;
  account_id: number;
  bio: string | null;
  qualification_level: string | null;
  years_experience: number;
  teaching_mode: TeachingMode;
  teaching_area: string | null;
  verification_status: TutorVerificationStatus;
  average_rating: string;
  rating_count: number;
}

export interface TutorPublicResponse {
  id: number;
  full_name: string;
  bio: string | null;
  qualification_level: string | null;
  years_experience: number;
  teaching_mode: TeachingMode;
  teaching_area: string | null;
  verification_status: TutorVerificationStatus;
  average_rating: string;
  rating_count: number;
  subjects: TutorSubjectResponse[];
  availabilities: TutorAvailabilityResponse[];
}

export interface TutorDetailResponse {
  profile: TutorProfileResponse & { full_name?: string | null; email?: string | null };
  qualifications: QualificationResponse[];
  subjects: TutorSubjectResponse[];
  availabilities: TutorAvailabilityResponse[];
}

export interface QualificationCreate {
  type: string;
  title: string;
  issuer?: string;
  file_url: string;
}

export interface QualificationResponse {
  id: number;
  type: string;
  title: string;
  issuer: string | null;
  file_url: string;
  status: QualificationStatus;
  review_note: string | null;
}

export interface TutorSubjectCreate {
  subject_id: number;
  grade_level: string;
  fee_per_session: string;
}

export interface TutorSubjectResponse {
  id: number;
  subject_id: number;
  subject_name: string | null;
  grade_level: string;
  fee_per_session: string;
  status: TutorSubjectStatus;
}

export interface AvailabilityCreate {
  day_of_week: number;
  start_time: string;
  end_time: string;
  mode?: TeachingMode;
}

export interface TutorAvailabilityResponse {
  id: number;
  day_of_week: number;
  start_time: string;
  end_time: string;
  mode: string;
}

/* ── Subjects ──────────────────────────────────────── */
export interface SubjectResponse {
  id: number;
  name: string;
  description: string | null;
  status: string;
}

export interface SubjectCreate {
  name: string;
  description?: string;
}

/* ── Learning Needs ───────────────────────────────── */
export type LearningNeedStatus = 'ACTIVE' | 'FULFILLED' | 'EXPIRED';

export interface LearningNeedScheduleCreate {
  day_of_week: number;
  start_time?: string;
  end_time?: string;
  time_slot?: string;
}

export interface LearningNeedCreate {
  subject_id?: number;
  grade_level?: string;
  goal?: string;
  budget_per_session_min?: string;
  budget_per_session_max?: string;
  preferred_mode?: TeachingMode;
  preferred_learning_type?: string;
  preferred_area?: string;
  raw_text?: string;
  schedules?: LearningNeedScheduleCreate[];
}

export interface LearningNeedScheduleResponse {
  id: number;
  day_of_week: number;
  start_time: string | null;
  end_time: string | null;
  time_slot: string | null;
}

export interface LearningNeedResponse {
  id: number;
  student_account_id: number;
  subject_id: number | null;
  grade_level: string | null;
  goal: string | null;
  budget_per_session_min: string | null;
  budget_per_session_max: string | null;
  preferred_mode: string;
  preferred_learning_type: string;
  preferred_area: string | null;
  raw_text: string | null;
  parsed_data: string | null;
  parser_source: string;
  parsed_confidence: string | null;
  status: LearningNeedStatus;
  schedules: LearningNeedScheduleResponse[];
}

/* ── Recommendations ──────────────────────────────── */
export interface RecommendedTutor {
  tutor: TutorPublicResponse;
  score: string | number;
  reasons: string[];
}

export interface RecommendedClass {
  course_class: CourseClassResponse;
  score: string | number;
  reasons: string[];
}

export interface RecommendationResponse {
  recommended_tutors: RecommendedTutor[];
  recommended_classes: RecommendedClass[];
}

export interface RecommendationEventCreate {
  event_type: string;
  learning_need_id?: number;
  tutor_id?: number;
  class_id?: number;
  metadata?: string;
}

/* ── Private Tutoring Request ────────────────────── */
export type PrivateRequestStatus =
  | 'SENT'
  | 'TUTOR_CONFIRMED'
  | 'TUTOR_REJECTED'
  | 'PAID'
  | 'ONGOING'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'REFUNDED';

export interface PrivateRequestCreate {
  tutor_id: number;
  learning_need_id?: number;
  subject_id: number;
  grade_level: string;
  goal?: string;
  requested_sessions: number;
  mode?: TeachingMode;
}

export interface PrivateRequestResponse {
  id: number;
  student_account_id: number;
  tutor_id: number;
  learning_need_id: number | null;
  subject_id: number;
  grade_level: string;
  goal: string | null;
  requested_sessions: number;
  mode: string;
  agreed_fee_per_session: string | null;
  status: PrivateRequestStatus;
  tutor_response_note: string | null;
  confirmed_at: string | null;
  tutor_name: string | null;
  student_name: string | null;
  subject_name: string | null;
}

export interface PrivateRequestConfirm {
  agreed_fee_per_session: string;
  response_note?: string;
}

export interface PrivateRequestReject {
  response_note?: string;
}

/* ── Course Classes ──────────────────────────────── */
export type ClassStatus =
  | 'DRAFT'
  | 'TUTOR_RECRUITING'
  | 'ENROLLING'
  | 'READY'
  | 'ONGOING'
  | 'COMPLETED'
  | 'CANCELLED';

export interface CourseClassCreate {
  subject_id: number;
  title: string;
  grade_level: string;
  goal?: string;
  fee_per_session_per_student: string;
  total_sessions: number;
  min_students: number;
  max_students: number;
  mode?: string;
  location?: string;
}

export interface CourseClassResponse {
  id: number;
  subject_id: number;
  primary_tutor_id: number | null;
  title: string;
  grade_level: string;
  goal: string | null;
  fee_per_session_per_student: string;
  total_sessions: number;
  min_students: number;
  max_students: number;
  mode: string;
  location: string | null;
  status: ClassStatus;
  created_by_account_id: number | null;
  tutor_name: string | null;
}

export interface TutorApplicationCreate {
  message?: string;
}

export interface TutorApplicationResponse {
  id: number;
  class_id: number;
  tutor_id: number;
  status: string;
  message: string | null;
}

export interface ClassRegistrationCreate {
  learning_need_id?: number;
}

export interface ClassRegistrationResponse {
  id: number;
  class_id: number;
  student_account_id: number;
  learning_need_id: number | null;
  status: string;
  review_note: string | null;
  class_title?: string;
  tutor_name?: string;
  subject_name?: string;
  total_sessions?: number;
  fee_per_session_per_student?: string;
}

/* ── Payments ─────────────────────────────────────── */
export type PaymentStatus = 'CREATED' | 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED' | 'REFUND_PENDING' | 'REFUNDED';

export interface PaymentResponse {
  id: number;
  student_account_id: number;
  target_type: string;
  target_id: number;
  contract_id: number | null;
  amount: string;
  currency: string;
  status: PaymentStatus;
  provider: string;
  paid_at: string | null;
  created_at: string;
  refund_amount: string | null;
  refund_reason: string | null;
  transfer_content?: string | null;
  qr_data_url?: string | null;
  expires_at?: string | null;
  qr_amount?: number | null;
  display_amount?: number | null;
  bank_info?: {
    bank_name: string;
    bank_code: string;
    account_number: string;
    account_name: string;
    amount: number;
    transfer_content: string | null;
  } | null;
  is_test_mode?: boolean;
  amount_divisor?: number;
  target_name?: string | null;
  tutor_name?: string | null;
  subject_name?: string | null;
}

export interface PaymentStatusResponse {
  payment_id: number;
  status: PaymentStatus;
  paid_at?: string | null;
}

/* ── Schedule & Sessions ──────────────────────────── */
export interface SchedulePatternCreate {
  private_request_id?: number;
  class_id?: number;
  day_of_week: number;
  start_time: string;
  end_time: string;
  start_date: string;
  end_date?: string;
  total_sessions?: number;
}

export interface SchedulePatternResponse {
  id: number;
  private_request_id: number | null;
  class_id: number | null;
  day_of_week: number;
  start_time: string;
  end_time: string;
  start_date: string;
  end_date: string | null;
  total_sessions: number | null;
}

export type SessionStatus = 'SCHEDULED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';

export interface LearningSessionResponse {
  id: number;
  private_request_id: number | null;
  class_id: number | null;
  tutor_id: number;
  session_number: number | null;
  session_date: string;
  start_time: string;
  end_time: string;
  status: SessionStatus;
  attendance_note: string | null;
  tutor_name: string | null;
  class_title: string | null;
  private_request_title: string | null;
}

export interface ScheduleBlockResponse {
  id: number;
  tutor_id: number;
  private_request_id: number | null;
  class_id: number | null;
  day_of_week: number;
  start_time: string;
  end_time: string;
  status: string;
}

/* ── Contracts ────────────────────────────────────── */
export type ContractStatus = 'PENDING' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';

export interface ContractCreate {
  tutor_id: number;
  private_request_id?: number;
  class_id?: number;
  commission_name_snapshot?: string;
  center_rate_snapshot?: string;
  tutor_rate_snapshot?: string;
}

export interface ContractResponse {
  id: number;
  tutor_id: number;
  private_request_id: number | null;
  class_id: number | null;
  commission_name_snapshot: string;
  center_rate_snapshot: string;
  tutor_rate_snapshot: string;
  status: ContractStatus;
  tutor_name?: string | null;
  target_name?: string | null;
}

/* ── Reviews ──────────────────────────────────────── */
export interface ReviewCreate {
  tutor_id: number;
  target_type: 'PRIVATE_TUTORING_REQUEST' | 'CLASS_REGISTRATION';
  target_id: number;
  rating: number;
  comment?: string;
}

export interface ReviewResponse {
  id: number;
  student_account_id: number;
  tutor_id: number;
  target_type: string;
  target_id: number;
  rating: number;
  comment: string | null;
  created_at: string | null;
  tutor_name: string | null;
  subject_name: string | null;
}

/* ── Staff ────────────────────────────────────────── */
export interface ReviewAction {
  action: 'APPROVED' | 'REJECTED';
  review_note?: string;
}

export interface TutorReviewAction {
  action: 'VERIFIED' | 'REJECTED';
  review_note?: string;
}

export interface ClassStatusUpdate {
  status: ClassStatus;
}

export type NotificationType =
  | 'SESSION_REMINDER'
  | 'SESSION_CANCELLED'
  | 'SESSION_RESCHEDULED'
  | 'NEW_MESSAGE';

export interface NotificationResponse {
  id: number;
  user_id: number;
  notification_type: NotificationType;
  title: string;
  body: string | null;
  reference_type: string | null;
  reference_id: number | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}
