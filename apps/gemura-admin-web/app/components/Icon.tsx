// Icon component wrapper for Font Awesome (copied from gemura-web)
import { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faLocationDot,
  faHashtag,
  faSquareCheck,
  faCircleQuestion,
  faFont,
  faFloppyDisk,
  faCircleInfo as faInfoCircleTemp,
  faEye,
  faEyeSlash,
  faEnvelope,
  faLock,
  faPhone,
} from "@fortawesome/free-solid-svg-icons";

interface IconProps {
  icon: IconDefinition;
  className?: string;
  size?: "xs" | "sm" | "lg" | "xl" | "2x";
  spin?: boolean;
  pulse?: boolean;
}

export default function Icon({ icon, className = "", size = "sm", spin = false, pulse = false }: IconProps) {
  return <FontAwesomeIcon icon={icon} className={className} size={size} spin={spin} pulse={pulse} />;
}

// Export commonly used icons for convenience (subset needed for login page)
export { faEye, faEyeSlash, faEnvelope, faLock, faPhone, faPhone as faNumberSign };
export const faMapPin = faLocationDot;
export const faText = faFont;
export { faHashtag, faSquareCheck, faCircleQuestion, faInfoCircleTemp as faInfoCircle };
export const faSave = faFloppyDisk;

