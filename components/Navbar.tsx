import Image from "next/image";
function KarrayHeartIcon() {
    return (
        <svg
            viewBox="0 0 32 30"
            aria-hidden="true"
            className="h-4 w-4"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
        >
            <path
                d="M16 27L5.2 16.5C1.4 12.8 1.4 6.9 5.2 3.5C8.7.3 14 .9 16 5.1C18 .9 23.3.3 26.8 3.5C30.6 6.9 30.6 12.8 26.8 16.5L16 27Z"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
            />

            <path
                d="M7.2 17.8L2.8 27.2"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
            />

            <path
                d="M24.8 17.8L29.2 27.2"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
            />
        </svg>
    );
}

export default function Navbar() {
    return (
        <header className="absolute left-0 top-0 z-50 w-full">
            <div className="mx-auto flex max-w-[1440px] items-center justify-between px-8 py-6 lg:px-16">
                <a href="/" className="flex items-center">
                    <Image
                        src="/images/karray-logo.png"
                        alt="KARRAY Models"
                        width={800}
                        height={300}
                        priority
                        className="h-auto w-[260px] object-contain lg:w-[355px]"
                    />
                </a>

                <nav className="hidden items-center gap-12 text-xl font-semibold uppercase tracking-[0.08em] text-white lg:flex">
                    <a
                        href="/"
                        className="group relative transition-all duration-300 hover:-translate-y-1"
                    >
                        <span className="transition-colors duration-300 group-hover:text-[#d68ca0]">
                            Início
                        </span>

                        <span className="absolute left-1/2 top-full mt-2 -translate-x-1/2 scale-0 text-[#d68ca0] opacity-0 transition-all duration-300 group-hover:scale-100 group-hover:opacity-100">
                            <KarrayHeartIcon />
                        </span>                    </a>
                    <a
                        href="/por-que-nos"
                        className="group relative transition-all duration-300 hover:-translate-y-1"
                    >
                        <span className="transition-colors duration-300 group-hover:text-[#d68ca0]">
                            Por Que Nós
                        </span>

                        <span className="absolute left-1/2 top-full mt-2 -translate-x-1/2 scale-0 text-[#d68ca0] opacity-0 transition-all duration-300 group-hover:scale-100 group-hover:opacity-100">
                            <KarrayHeartIcon />
                        </span>                    </a>

                    <a
                        href="/servicos"
                        className="group relative transition-all duration-300 hover:-translate-y-1"
                    >
                        <span className="transition-colors duration-300 group-hover:text-[#d68ca0]">
                            Serviços
                        </span>

                        <span className="absolute left-1/2 top-full mt-2 -translate-x-1/2 scale-0 text-[#d68ca0] opacity-0 transition-all duration-300 group-hover:scale-100 group-hover:opacity-100">
                            <KarrayHeartIcon />
                        </span>                    </a>

                    <a
                        href="/faq"
                        className="group relative transition-all duration-300 hover:-translate-y-1"
                    >
                        <span className="transition-colors duration-300 group-hover:text-[#d68ca0]">
                            FAQ
                        </span>

                        <span className="absolute left-1/2 top-full mt-2 -translate-x-1/2 scale-0 text-[#d68ca0] opacity-0 transition-all duration-300 group-hover:scale-100 group-hover:opacity-100">
                            <KarrayHeartIcon />
                        </span>                    </a>

                    <a
                        href="/contato"
                        className="group relative transition-all duration-300 hover:-translate-y-1"
                    >
                        <span className="transition-colors duration-300 group-hover:text-[#d68ca0]">
                            Contato
                        </span>

                        <span className="absolute left-1/2 top-full mt-2 -translate-x-1/2 scale-0 text-[#d68ca0] opacity-0 transition-all duration-300 group-hover:scale-100 group-hover:opacity-100">
                            <KarrayHeartIcon /> 
                        </span>                    </a>
                </nav>

                <a
                    href="/aplicar"
                    className="rounded-full bg-[#c65f7c] px-8 py-4 text-sm font-bold uppercase tracking-[0.14em] text-white transition hover:bg-[#ae4f6b]"
                >
                    Candidate-se
                </a>
            </div>
        </header>
    );
}