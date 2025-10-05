export const LogoNext = () => (
  <svg
    height={20}
    strokeLinejoin="round"
    viewBox="0 0 16 16"
    width={20}
    style={{ color: "currentcolor" }}
  >
    <g clipPath="url(#clip0_53_108)">
      <circle
        cx="8"
        cy="8"
        r="7.375"
        fill="black"
        stroke="var(--ds-gray-1000)"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      ></circle>
      <path
        d="M10.63 11V5"
        stroke="url(#paint0_linear_53_1080o22379mo)"
        strokeWidth="1.25"
        strokeMiterlimit="1.41421"
      ></path>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M5.995 5.00087V5H4.745V11H5.995V6.96798L12.3615 14.7076C12.712 14.4793 13.0434 14.2242 13.353 13.9453L5.99527 5.00065L5.995 5.00087Z"
        fill="url(#paint1_linear_53_1080o22379mo)"
      ></path>
    </g>
    <defs>
      <linearGradient
        id="paint0_linear_53_1080o22379mo"
        x1="11.13"
        y1="5"
        x2="11.13"
        y2="11"
        gradientUnits="userSpaceOnUse"
      >
        <stop stopColor="white"></stop>
        <stop offset="0.609375" stopColor="white" stopOpacity="0.57"></stop>
        <stop offset="0.796875" stopColor="white" stopOpacity="0"></stop>
        <stop offset="1" stopColor="white" stopOpacity="0"></stop>
      </linearGradient>
      <linearGradient
        id="paint1_linear_53_1080o22379mo"
        x1="9.9375"
        y1="9.0625"
        x2="13.5574"
        y2="13.3992"
        gradientUnits="userSpaceOnUse"
      >
        <stop stopColor="white"></stop>
        <stop offset="1" stopColor="white" stopOpacity="0"></stop>
      </linearGradient>
      <clipPath id="clip0_53_108">
        <rect width="16" height="16" fill="red"></rect>
      </clipPath>
    </defs>
  </svg>
);

export const MoonIcon = ({ size = 16 }: { size?: number }) => {
  return (
    <svg
      height={size}
      strokeLinejoin="round"
      viewBox="0 0 16 16"
      width={size}
      style={{ color: "currentcolor" }}
    >
      <g clip-path="url(#clip0_174_19363)">
        <path
          fill-rule="evenodd"
          clip-rule="evenodd"
          d="M14.5 8C14.5 11.5899 11.5899 14.5 8 14.5C4.88067 14.5 2.27454 12.3027 1.64496 9.37151C1.81218 9.77621 2.05228 10.1443 2.36758 10.4596C4.04598 12.138 7.21941 11.6857 9.45566 9.44949C11.6919 7.21325 12.1441 4.03981 10.4657 2.36142C10.1601 2.05583 9.80498 1.82087 9.41495 1.65445C12.3244 2.30033 14.5 4.8961 14.5 8ZM16 8C16 12.4183 12.4183 16 8 16C3.58172 16 0 12.4183 0 8C0 3.58172 3.58172 0 8 0C12.4183 0 16 3.58172 16 8Z"
          fill="currentColor"
        ></path>
      </g>
      <defs>
        <clipPath id="clip0_174_19363">
          <rect width="16" height="16" fill="white"></rect>
        </clipPath>
      </defs>
    </svg>
  );
};

export const SunIcon = ({ size = 16 }: { size?: number }) => {
  return (
    <svg
      height={size}
      stroke-linejoin="round"
      viewBox="0 0 16 16"
      width={size}
      style={{ color: "currentcolor" }}
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M8.75 0.75V0H7.25V0.75V2V2.75H8.75V2V0.75ZM11.182 3.75732L11.7123 3.22699L12.0659 2.87344L12.5962 2.34311L13.6569 3.40377L13.1265 3.9341L12.773 4.28765L12.2426 4.81798L11.182 3.75732ZM8 10.5C9.38071 10.5 10.5 9.38071 10.5 8C10.5 6.61929 9.38071 5.5 8 5.5C6.61929 5.5 5.5 6.61929 5.5 8C5.5 9.38071 6.61929 10.5 8 10.5ZM8 12C10.2091 12 12 10.2091 12 8C12 5.79086 10.2091 4 8 4C5.79086 4 4 5.79086 4 8C4 10.2091 5.79086 12 8 12ZM13.25 7.25H14H15.25H16V8.75H15.25H14H13.25V7.25ZM0.75 7.25H0V8.75H0.75H2H2.75V7.25H2H0.75ZM2.87348 12.0659L2.34315 12.5962L3.40381 13.6569L3.93414 13.1265L4.28769 12.773L4.81802 12.2426L3.75736 11.182L3.22703 11.7123L2.87348 12.0659ZM3.75735 4.81798L3.22702 4.28765L2.87347 3.9341L2.34314 3.40377L3.4038 2.34311L3.93413 2.87344L4.28768 3.22699L4.81802 3.75732L3.75735 4.81798ZM12.0659 13.1265L12.5962 13.6569L13.6569 12.5962L13.1265 12.0659L12.773 11.7123L12.2426 11.182L11.182 12.2426L11.7123 12.773L12.0659 13.1265ZM8.75 13.25V14V15.25V16H7.25V15.25V14V13.25H8.75Z"
        fill="currentColor"
      ></path>
    </svg>
  );
};
