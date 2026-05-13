// Icon component wrapper for Font Awesome
import { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faLocationDot,
  faHashtag,
  faSquareCheck,
  faCircleQuestion,
  faFont,
  faFloppyDisk,
  faCircleInfo as faInfoCircleTemp,
  faCalendarDays,
  faStar,
  faCircleXmark as faCircleXmarkIcon,
} from '@fortawesome/free-solid-svg-icons';

interface IconProps {
  icon: IconDefinition;
  className?: string;
  size?: 'xs' | 'sm' | 'lg' | 'xl' | '2x';
  spin?: boolean;
  pulse?: boolean;
}

export default function Icon({ 
  icon, 
  className = '', 
  size = 'sm',
  spin = false,
  pulse = false,
}: IconProps) {
  return (
    <FontAwesomeIcon 
      icon={icon} 
      className={className}
      size={size}
      spin={spin}
      pulse={pulse}
    />
  );
}

// Export commonly used icons for convenience
export { 
  faHome,
  faUser,
  faEnvelope,
  faPhone,
  faSearch,
  faBars,
  faTimes,
  faChevronDown,
  faChevronUp,
  faChevronLeft,
  faChevronRight,
  faArrowRight,
  faArrowLeft,
  faArrowDown,
  faArrowUp,
  faCheck,
  faEdit,
  faTrash,
  faPlus,
  faMinus,
  faDownload,
  faUpload,
  faFile,
  faCalendar,
  faClock,
  faBell,
  faCog,
  faRightFromBracket,
  faUsers,
  faCheckCircle,
  faFileAlt,
  faLock,
  faUserShield,
  faEye,
  faEyeSlash,
  faSpinner,
  faChartLine,
  faList,
  faTag,
  faUserPlus,
  faUserMinus,
  faClipboardList,
  faHeart,
  faBaby,
  faArrowsUpDown,
  faCircleXmark,
  faBriefcase,
  faUserFriends,
  faIdCard,
  faFont,
  faFloppyDisk,
  faDollarSign,
  faWarehouse,
  faShoppingCart,
  faBox,
  faTruck,
  faChartBar,
  faReceipt,
  faCreditCard,
  faWallet,
  faBuilding,
  faStore,
  faFilter,
  faTriangleExclamation,
  faArrowsRotate,
  faHandHoldingDollar,
} from '@fortawesome/free-solid-svg-icons';

// Export aliases for convenience  
export const faMapPin = faLocationDot;
export const faText = faFont;
export { faHashtag };
export { faSquareCheck };
export { faCircleQuestion };
export const faNumberSign = faHashtag;
export const faCheckSquare = faSquareCheck;
export const faQuestionCircle = faCircleQuestion;
export const faSave = faFloppyDisk;
export const faInfoCircle = faInfoCircleTemp;
export const faCalendarAlt = faCalendarDays;
export const faTimesCircle = faCircleXmarkIcon;
export { faCalendarDays, faStar };
